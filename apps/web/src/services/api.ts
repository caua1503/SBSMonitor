import { getToken, logout } from "./auth";

export interface AgentInfo {
  id: string;
  hostname: string;
  platform: string;
  ip: string | null;
  registered_at: number;
  last_seen_at: number | null;
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

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const getBaseUrl = (): string => {
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    return "http://localhost:3000";
  }
  return "";
};

const BASE_URL = getBaseUrl();

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    logout();
    // Força re-render via evento customizado — App.tsx escuta e redireciona para login
    window.dispatchEvent(new CustomEvent("auth:expired"));
    throw new Error("Sessão expirada");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.ok) throw new Error(json.error || "Erro desconhecido");
  return json.data as T;
}

export interface CreatedAgent {
  id: string;
  secret: string;
}

export const api = {
  async getAgents(): Promise<AgentInfo[]> {
    const res = await fetch(`${BASE_URL}/api/v1/agents`, { headers: authHeaders() });
    return handleResponse<AgentInfo[]>(res) ?? [];
  },

  async getAgent(id: string): Promise<AgentInfo> {
    const res = await fetch(`${BASE_URL}/api/v1/agents/${id}`, { headers: authHeaders() });
    return handleResponse<AgentInfo>(res);
  },

  async getAgentMetrics(id: string, limit = 50): Promise<MetricRow[]> {
    const res = await fetch(`${BASE_URL}/api/v1/agents/${id}/metrics?limit=${limit}`, {
      headers: authHeaders(),
    });
    return handleResponse<MetricRow[]>(res) ?? [];
  },

  async createAgent(data: {
    hostname: string;
    platform: string;
    ip?: string;
  }): Promise<CreatedAgent> {
    const res = await fetch(`${BASE_URL}/api/v1/admin/agents`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<CreatedAgent>(res);
  },

  async deleteAgent(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/v1/admin/agents/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return handleResponse<void>(res);
  },
};

