import type { Database } from "../../../db/index.ts";
import { ok, err } from "../../../router.ts";
import { authenticateAgent } from "../../../middleware/auth.ts";

/**
 * POST /api/v1/agents/heartbeat
 * Atualiza last_seen_at sem exigir envio de métricas completas.
 */
export async function handleHeartbeat(req: Request, db: Database): Promise<Response> {
  const agentId = await authenticateAgent(req, db);
  if (!agentId) return err("Unauthorized", 401);

  await db.agents.updateLastSeen(agentId, Date.now());

  console.log(`[Server] Heartbeat: ${agentId}`);
  return ok({ received_at: new Date().toISOString() });
}
