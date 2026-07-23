import type { Database } from "../db/index.ts";
import { verifyJwt } from "./jwt.ts";
import { SERVER_CONFIG } from "../config.ts";
import { err } from "../router.ts";

/**
 * Verifica X-Agent-ID e X-Agent-Secret contra o banco.
 * Retorna o agentId autenticado ou null em caso de falha.
 */
export async function authenticateAgent(req: Request, db: Database): Promise<string | null> {
  const agentId = req.headers.get("X-Agent-ID");
  const agentSecret = req.headers.get("X-Agent-Secret");

  if (!agentId || !agentSecret) return null;

  const agent = await db.agents.findById(agentId);
  if (!agent) return null;

  const valid = await Bun.password.verify(agentSecret, agent.secret_hash);
  if (!valid) return null;

  return agentId;
}

/**
 * Middleware de autenticação administrativa via JWT.
 * Retorna Response 401 se o token for ausente, inválido ou expirado.
 * Retorna null se a requisição estiver autenticada (prosseguir normalmente).
 */
export async function requireAdminAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return err("Unauthorized", 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, SERVER_CONFIG.jwtSecret);
  if (!payload) {
    return err("Unauthorized", 401);
  }

  return null;
}
