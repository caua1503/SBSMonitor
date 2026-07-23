import type { Database } from "../../../db/index.ts";
import { ok, err } from "../../../router.ts";

/** GET /api/v1/agents/:id/metrics — retorna histórico de métricas de um Agent */
export async function handleGetAgentMetrics(
  req: Request,
  params: Record<string, string>,
  db: Database
): Promise<Response> {
  const id = params["id"];
  if (!id) return err("Missing agent ID", 400);

  const agent = await db.agents.findById(id);
  if (!agent) return err("Agent not found", 404);

  const url = new URL(req.url);
  const limitStr = url.searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 100;

  if (isNaN(limit) || limit <= 0) {
    return err("Invalid limit parameter", 400);
  }

  const metrics = await db.metrics.listByAgent(id, limit);
  return ok(metrics);
}
