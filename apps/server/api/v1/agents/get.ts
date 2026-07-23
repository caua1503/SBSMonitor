import type { Database } from "../../../db/index.ts";
import { ok, err } from "../../../router.ts";

/** GET /api/v1/agents/:id — retorna dados de um Agent específico */
export async function handleGetAgent(
  _req: Request,
  params: Record<string, string>,
  db: Database
): Promise<Response> {
  const id = params["id"];
  if (!id) return err("Missing agent ID", 400);

  const agent = await db.agents.findById(id);
  if (!agent) return err("Agent not found", 404);

  // Remove secret_hash — nunca expor na API
  const info = {
    id: agent.id,
    hostname: agent.hostname,
    platform: agent.platform,
    ip: agent.ip,
    registered_at: agent.registered_at,
    last_seen_at: agent.last_seen_at,
  };

  return ok(info);
}
