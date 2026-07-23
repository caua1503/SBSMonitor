import type { Database } from "../../../db/index.ts";
import { ok, err } from "../../../router.ts";
import type { RegisterPayload } from "@repo/shared/types";

/**
 * POST /api/v1/agents/register
 *
 * Idempotente:
 * - Primeiro registro: cria agent com secret hasheado
 * - Re-registro: verifica secret antes de atualizar hostname/platform/ip
 */
export async function handleRegister(req: Request, db: Database): Promise<Response> {
  const agentId = req.headers.get("X-Agent-ID");
  const agentSecret = req.headers.get("X-Agent-Secret");

  if (!agentId || !agentSecret) {
    return err("Missing X-Agent-ID or X-Agent-Secret headers", 401);
  }

  let body: RegisterPayload;
  try {
    body = await req.json() as RegisterPayload;
  } catch {
    return err("Invalid JSON body", 400);
  }

  if (!body.hostname || !body.platform) {
    return err("Missing required fields: hostname, platform", 400);
  }

  const existing = await db.agents.findById(agentId);

  if (existing) {
    // Re-registro: verifica credencial antes de atualizar dados
    const valid = await Bun.password.verify(agentSecret, existing.secret_hash);
    if (!valid) return err("Invalid credentials", 401);

    await db.agents.update(agentId, {
      hostname: body.hostname,
      platform: body.platform,
      ip: body.ip ?? null,
    });
    await db.agents.updateLastSeen(agentId, Date.now());

    console.log(`[Server] Agent re-registered: ${agentId}`);
    return ok({ id: agentId, registered: false, updated: true });
  }

  // Novo registro
  const secretHash = await Bun.password.hash(agentSecret);
  await db.agents.create({
    id: agentId,
    secretHash,
    hostname: body.hostname,
    platform: body.platform,
    ip: body.ip ?? null,
  });

  console.log(`[Server] Agent registered: ${agentId}`);
  return ok({ id: agentId, registered: true, updated: false }, 201);
}
