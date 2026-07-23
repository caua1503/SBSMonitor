import type { AgentInfo, MetricsPayload } from "@repo/shared/types";

export type { AgentInfo };

// --- Registros internos (incluem dados sensíveis) ---

export interface AgentRecord {
  id: string;
  secretHash: string;
  hostname: string;
  platform: string;
  ip: string | null;
}

/** Linha raw do banco — inclui secret_hash, não expor diretamente na API */
export interface AgentRow {
  id: string;
  secret_hash: string;
  hostname: string;
  platform: string;
  ip: string | null;
  registered_at: number;
  last_seen_at: number | null;
}

export interface MetricRecord {
  agentId: string;
  payload: MetricsPayload;
  receivedAt: number;
}

export interface MetricRow {
  id: number;
  agent_id: string;
  collected_at: number;
  received_at: number;
  cpu_used_pct: number;
  mem_total_bytes: number;
  mem_used_bytes: number;
  mem_free_bytes: number;
  mem_used_pct: number;
  disk_total_bytes: number;
  disk_used_bytes: number;
  disk_free_bytes: number;
  disk_used_pct: number;
  net_ip: string | null;
  sys_process_count: number | null;
}

export type AlertMetricName = "cpu" | "memory" | "disk";

export interface MetricAlertRecord {
  agentId: string;
  metric: AlertMetricName;
  active: boolean;
  lastValue: number;
  threshold: number;
  lastTriggeredAt: number | null;
  updatedAt: number;
}

export interface MetricAlertRow {
  agent_id: string;
  metric: AlertMetricName;
  active: number;
  last_value: number;
  threshold: number;
  last_triggered_at: number | null;
  updated_at: number;
}

// --- Interfaces de repositório ---
// Retornam Promise para compatibilidade com implementações assíncronas (PostgreSQL)

export interface AgentRepository {
  /** Busca por ID — inclui secret_hash para verificação interna */
  findById(id: string): Promise<AgentRow | null>;
  create(record: AgentRecord): Promise<void>;
  update(id: string, data: Pick<AgentRecord, "hostname" | "platform" | "ip">): Promise<void>;
  updateLastSeen(id: string, at: number): Promise<void>;
  /** Remove um agent e todas as suas métricas */
  delete(id: string): Promise<void>;
  /** Lista pública — sem secret_hash */
  list(): Promise<AgentInfo[]>;
}

export interface MetricRepository {
  insert(record: MetricRecord): Promise<void>;
  listByAgent(agentId: string, limit?: number): Promise<MetricRow[]>;
}

export interface MetricAlertRepository {
  find(agentId: string, metric: AlertMetricName): Promise<MetricAlertRecord | null>;
  markActive(record: Omit<MetricAlertRecord, "active">): Promise<void>;
  markRecovered(agentId: string, metric: AlertMetricName, value: number, threshold: number, at: number): Promise<void>;
}

export interface Database {
  agents: AgentRepository;
  metrics: MetricRepository;
  alerts: MetricAlertRepository;
  /** Libera conexão — chamado no graceful shutdown */
  close(): void;
}
