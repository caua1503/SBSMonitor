import type { Database } from "../../../db/index.ts";
import { ok } from "../../../router.ts";

/** GET /api/v1/agents — lista todos os agents cadastrados */
export async function handleListAgents(_req: Request, db: Database): Promise<Response> {
  const agents = await db.agents.list();
  return ok(agents);
}
