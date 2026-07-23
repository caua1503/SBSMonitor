import { ok, err } from "../../../router.ts";
import { signJwt } from "../../../middleware/jwt.ts";
import { SERVER_CONFIG } from "../../../config.ts";

// Credencial hardcoded — fase inicial de desenvolvimento.
// Migrar para banco de dados quando o cadastro de usuários for implementado.
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD_HASH = await Bun.password.hash("admin");

interface LoginBody {
  username?: string;
  password?: string;
}

/** POST /api/v1/auth/login */
export async function handleLogin(req: Request): Promise<Response> {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return err("Invalid JSON body", 400);
  }

  const { username, password } = body;
  if (!username || !password) {
    return err("Missing username or password", 400);
  }

  if (username !== ADMIN_USERNAME) {
    return err("Invalid credentials", 401);
  }

  const valid = await Bun.password.verify(password, ADMIN_PASSWORD_HASH);
  if (!valid) {
    return err("Invalid credentials", 401);
  }

  const token = await signJwt("admin", SERVER_CONFIG.jwtSecret);
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;

  return ok({ token, expiresAt });
}
