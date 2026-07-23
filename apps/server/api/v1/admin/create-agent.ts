import { ok, err } from "../../../router.ts";
import type { Database } from "../../../db/index.ts";

function generateId(): string {
  // UUID v4 via Web Crypto
  return crypto.randomUUID();
}

function generateSecret(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * POST /api/v1/admin/agents
 *
 * Cria um novo agent com credenciais geradas pelo servidor.
 * As credenciais (id + secret) são retornadas UMA ÚNICA VEZ — o secret
 * não é recuperável após essa resposta (apenas o hash fica no banco).
 */
export async function handleAdminCreateAgent(
  req: Request,
  db: Database
): Promise<Response> {
  let body: { hostname?: string; platform?: string; ip?: string };
  try {
    body = await req.json() as { hostname?: string; platform?: string; ip?: string };
  } catch {
    return err("Invalid JSON body", 400);
  }

  const { hostname, platform, ip } = body;

  if (!hostname || typeof hostname !== "string" || hostname.trim() === "") {
    return err("Missing required field: hostname", 400);
  }
  if (!platform || typeof platform !== "string" || platform.trim() === "") {
    return err("Missing required field: platform", 400);
  }

  const id = generateId();
  const secret = generateSecret();
  const secretHash = await Bun.password.hash(secret);

  await db.agents.create({
    id,
    secretHash,
    hostname: hostname.trim(),
    platform: platform.trim(),
    ip: ip?.trim() || null,
  });

  console.log(`[Admin] Agent created via dashboard: ${id}`);

  return ok({ id, secret }, 201);
}
