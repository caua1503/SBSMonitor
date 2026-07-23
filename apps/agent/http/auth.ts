import { AGENT_CONFIG } from "../config.ts";

/** Retorna os headers de autenticação para cada requisição ao Server */
export function authHeaders(): Record<string, string> {
  return {
    "X-Agent-ID": AGENT_CONFIG.agentId,
    "X-Agent-Secret": AGENT_CONFIG.agentSecret,
  };
}
