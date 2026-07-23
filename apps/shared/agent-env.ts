export interface AgentEnv {
  serverUrl: string;
  agentId: string;
  agentSecret: string;
  /** Intervalo de coleta em segundos */
  collectInterval: number;
  /** Timeout das requisições HTTP em milissegundos */
  requestTimeout: number;
}

export function loadAgentEnv(): AgentEnv {
  const agentId = Bun.env["AGENT_ID"];
  const agentSecret = Bun.env["AGENT_SECRET"];

  if (!agentId) throw new Error("Missing required env var: AGENT_ID");
  if (!agentSecret) throw new Error("Missing required env var: AGENT_SECRET");

  return {
    serverUrl: Bun.env["SERVER_URL"] ?? "http://localhost:3000",
    agentId,
    agentSecret,
    collectInterval: Number(Bun.env["COLLECT_INTERVAL"] ?? "60"),
    requestTimeout: Number(Bun.env["REQUEST_TIMEOUT"] ?? "10000"),
  };
}
