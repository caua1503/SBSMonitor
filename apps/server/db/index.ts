import { createSqliteDatabase } from "./sqlite.ts";
import { SERVER_CONFIG } from "../config.ts";

export type {
  AlertMetricName,
  Database,
  AgentRepository,
  MetricAlertRepository,
  MetricRepository,
  AgentRow,
  MetricAlertRecord,
  MetricAlertRow,
  MetricRow,
  AgentRecord,
  MetricRecord,
} from "./types.ts";

/**
 * Factory de banco de dados.
 * Para migrar para PostgreSQL: substitua createSqliteDatabase() por createPostgresDatabase()
 * e implemente a mesma interface Database em ./postgres.ts
 */
export function createDatabase() {
  // Future: if (SERVER_CONFIG.databaseDriver === "postgres") return createPostgresDatabase(SERVER_CONFIG.databaseUrl);
  return createSqliteDatabase(SERVER_CONFIG.databaseUrl);
}
