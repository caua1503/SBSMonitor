import { ok, err } from "../../../router.ts";
import type { Database } from "../../../db/index.ts";

/**
 * DELETE /api/v1/admin/agents/:id
 * Remove um agent e todas as suas métricas
 */
export async function handleAdminDeleteAgent(
  req: Request,
  params: Record<string, string>,
  db: Database
): Promise<Response> {
  const id = params["id"];
  if (!id) return err("Missing agent ID", 400);

  const agent = await db.agents.findById(id);
  if (!agent) return err("Agent not found", 404);

  await db.agents.delete(id);

  console.log(`[Admin] Agent deleted via dashboard: ${id}`);

  return ok({ id, deleted: true });
}
