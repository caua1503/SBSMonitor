// Métricas coletadas pelo Agent

export interface CpuMetrics {
  used_percentage: number;
}

export interface MemoryMetrics {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  used_percentage: number;
}

export interface DiskMetrics {
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  used_percentage: number;
}

export interface NetworkMetrics {
  ip: string;
}

export interface SystemMetrics {
  process_count: number;
}

export interface MetricsPayload {
  /** ID do agente — validado contra X-Agent-ID do header */
  agent_id: string;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
  system: SystemMetrics;
  /** ISO 8601 — timestamp de quando as métricas foram coletadas no Agent */
  collected_at: string;
}

// Registro do Agent

export interface RegisterPayload {
  hostname: string;
  platform: string;
  ip: string;
}

/** Informações públicas de um Agent — sem secret_hash */
export interface AgentInfo {
  id: string;
  hostname: string;
  platform: string;
  ip: string | null;
  registered_at: number;
  last_seen_at: number | null;
}

/** Formato padrão de resposta da API */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
