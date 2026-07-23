import { Database as SqliteDB } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  AgentInfo,
  AgentRecord,
  AgentRepository,
  AgentRow,
  Database,
  MetricAlertRecord,
  MetricAlertRepository,
  MetricAlertRow,
  MetricRecord,
  MetricRepository,
  MetricRow,
} from "./types.ts";

const SCHEMA = /* sql */ `
  CREATE TABLE IF NOT EXISTS agents (
    id             TEXT    PRIMARY KEY,
    secret_hash    TEXT    NOT NULL,
    hostname       TEXT    NOT NULL,
    platform       TEXT    NOT NULL,
    ip             TEXT,
    registered_at  INTEGER NOT NULL,
    last_seen_at   INTEGER
  );

  CREATE TABLE IF NOT EXISTS metrics (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id          TEXT    NOT NULL REFERENCES agents(id),
    collected_at      INTEGER NOT NULL,
    received_at       INTEGER NOT NULL,
    cpu_used_pct      REAL    NOT NULL,
    mem_total_bytes   INTEGER NOT NULL,
    mem_used_bytes    INTEGER NOT NULL,
    mem_free_bytes    INTEGER NOT NULL,
    mem_used_pct      REAL    NOT NULL,
    disk_total_bytes  INTEGER NOT NULL,
    disk_used_bytes   INTEGER NOT NULL,
    disk_free_bytes   INTEGER NOT NULL,
    disk_used_pct     REAL    NOT NULL,
    net_ip            TEXT,
    sys_process_count INTEGER
  );

  CREATE TABLE IF NOT EXISTS metric_alerts (
    agent_id          TEXT    NOT NULL REFERENCES agents(id),
    metric            TEXT    NOT NULL,
    active            INTEGER NOT NULL,
    last_value        REAL    NOT NULL,
    threshold         REAL    NOT NULL,
    last_triggered_at INTEGER,
    updated_at        INTEGER NOT NULL,
    PRIMARY KEY (agent_id, metric)
  );
`;

function buildAgentRepository(db: SqliteDB): AgentRepository {
  const qFindById = db.query<AgentRow, [string]>(
    "SELECT * FROM agents WHERE id = ?"
  );
  const qList = db.query<AgentInfo, []>(
    "SELECT id, hostname, platform, ip, registered_at, last_seen_at FROM agents ORDER BY registered_at DESC"
  );
  const qCreate = db.query(
    "INSERT INTO agents (id, secret_hash, hostname, platform, ip, registered_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const qUpdate = db.query(
    "UPDATE agents SET hostname = ?, platform = ?, ip = ? WHERE id = ?"
  );
  const qUpdateLastSeen = db.query(
    "UPDATE agents SET last_seen_at = ? WHERE id = ?"
  );
  const qDeleteMetrics = db.query("DELETE FROM metrics WHERE agent_id = ?");
  const qDeleteAlerts = db.query("DELETE FROM metric_alerts WHERE agent_id = ?");
  const qDeleteAgent = db.query("DELETE FROM agents WHERE id = ?");

  return {
    findById: (id) => Promise.resolve(qFindById.get(id)),
    list: () => Promise.resolve(qList.all()),
    create: (record: AgentRecord) => {
      qCreate.run(record.id, record.secretHash, record.hostname, record.platform, record.ip, Date.now());
      return Promise.resolve();
    },
    update: (id, data) => {
      qUpdate.run(data.hostname, data.platform, data.ip, id);
      return Promise.resolve();
    },
    updateLastSeen: (id, at) => {
      qUpdateLastSeen.run(at, id);
      return Promise.resolve();
    },
    delete: (id) => {
      db.transaction(() => {
        qDeleteMetrics.run(id);
        qDeleteAlerts.run(id);
        qDeleteAgent.run(id);
      })();
      return Promise.resolve();
    },
  };
}

function toMetricAlertRecord(row: MetricAlertRow | null): MetricAlertRecord | null {
  if (!row) return null;

  return {
    agentId: row.agent_id,
    metric: row.metric,
    active: row.active === 1,
    lastValue: row.last_value,
    threshold: row.threshold,
    lastTriggeredAt: row.last_triggered_at,
    updatedAt: row.updated_at,
  };
}

function buildMetricAlertRepository(db: SqliteDB): MetricAlertRepository {
  const qFind = db.query<MetricAlertRow, [string, string]>(
    "SELECT * FROM metric_alerts WHERE agent_id = ? AND metric = ?"
  );
  const qUpsert = db.query(
    `INSERT INTO metric_alerts (
      agent_id, metric, active, last_value, threshold, last_triggered_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id, metric) DO UPDATE SET
      active = excluded.active,
      last_value = excluded.last_value,
      threshold = excluded.threshold,
      last_triggered_at = excluded.last_triggered_at,
      updated_at = excluded.updated_at`
  );

  return {
    find: (agentId, metric) =>
      Promise.resolve(toMetricAlertRecord(qFind.get(agentId, metric))),
    markActive: (record) => {
      qUpsert.run(
        record.agentId,
        record.metric,
        1,
        record.lastValue,
        record.threshold,
        record.lastTriggeredAt,
        record.updatedAt
      );
      return Promise.resolve();
    },
    markRecovered: (agentId, metric, value, threshold, at) => {
      qUpsert.run(agentId, metric, 0, value, threshold, null, at);
      return Promise.resolve();
    },
  };
}

function buildMetricRepository(db: SqliteDB): MetricRepository {
  const qInsert = db.query(
    `INSERT INTO metrics (
      agent_id, collected_at, received_at,
      cpu_used_pct,
      mem_total_bytes, mem_used_bytes, mem_free_bytes, mem_used_pct,
      disk_total_bytes, disk_used_bytes, disk_free_bytes, disk_used_pct,
      net_ip, sys_process_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const qListByAgent = db.query<MetricRow, [string, number]>(
    "SELECT * FROM metrics WHERE agent_id = ? ORDER BY received_at DESC LIMIT ?"
  );

  return {
    insert: (record: MetricRecord) => {
      const { payload, agentId, receivedAt } = record;
      const collectedAt = new Date(payload.collected_at).getTime();
      qInsert.run(
        agentId, collectedAt, receivedAt,
        payload.cpu.used_percentage,
        payload.memory.total_bytes, payload.memory.used_bytes,
        payload.memory.free_bytes, payload.memory.used_percentage,
        payload.disk.total_bytes, payload.disk.used_bytes,
        payload.disk.free_bytes, payload.disk.used_percentage,
        payload.network.ip,
        payload.system.process_count,
      );
      return Promise.resolve();
    },
    listByAgent: (agentId, limit = 100) =>
      Promise.resolve(qListByAgent.all(agentId, limit)),
  };
}

/**
 * Cria e inicializa o banco SQLite.
 * Statements são preparados uma vez e reutilizados — performance de prepared statements.
 * WAL mode habilitado para melhor throughput em leituras concorrentes.
 */
export function createSqliteDatabase(dbPath: string): Database {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new SqliteDB(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);

  return {
    agents: buildAgentRepository(db),
    metrics: buildMetricRepository(db),
    alerts: buildMetricAlertRepository(db),
    close: () => db.close(),
  };
}
