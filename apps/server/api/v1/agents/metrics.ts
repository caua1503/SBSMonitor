import type { Database } from "../../../db/index.ts";
import { ok, err } from "../../../router.ts";
import { authenticateAgent } from "../../../middleware/auth.ts";
import type { MetricsPayload } from "@repo/shared/types";
import { evaluateMetricAlerts } from "../../../alerts.service.ts";

/**
 * POST /api/v1/agents/metrics
 * Autentica, valida o payload e persiste as métricas.
 * Também atualiza last_seen_at do Agent.
 */
export async function handleMetrics(req: Request, db: Database): Promise<Response> {
  const agentId = await authenticateAgent(req, db);
  if (!agentId) return err("Unauthorized", 401);

  let payload: MetricsPayload;
  try {
    payload = await req.json() as MetricsPayload;
  } catch {
    return err("Invalid JSON body", 400);
  }

  if (!payload.cpu || !payload.memory || !payload.disk || !payload.collected_at) {
    return err("Missing required metric fields", 400);
  }

  // Validação cruzada: agent_id no payload deve corresponder ao X-Agent-ID do header
  if (payload.agent_id && payload.agent_id !== agentId) {
    console.warn(`[Server] Agent ID mismatch: header=${agentId}, payload=${payload.agent_id}`);
    return err("Agent ID mismatch — possible spoofing attempt", 403);
  }

  const receivedAt = Date.now();
  await db.agents.updateLastSeen(agentId, receivedAt);
  await db.metrics.insert({ agentId, payload, receivedAt });
  await evaluateMetricAlerts(db, agentId, payload, receivedAt);

  console.log(`[Server] Metrics from ${agentId} — CPU: ${payload.cpu.used_percentage}% | RAM: ${payload.memory.used_percentage}% | Disk: ${payload.disk.used_percentage}%`);
  return ok({ received_at: new Date(receivedAt).toISOString() });
}
