/**
 * JWT minimalista — HMAC-SHA256 via Web Crypto API nativa do Bun.
 * Sem dependências externas.
 */

const ALG = "HS256";
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

export interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Gera um JWT com expiração de 8 horas */
export async function signJwt(subject: string, secret: string): Promise<string> {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: ALG, typ: "JWT" })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    new TextEncoder().encode(
      JSON.stringify({ sub: subject, iat: now, exp: now + TOKEN_TTL_MS / 1000 })
    )
  );

  const data = toArrayBuffer(new TextEncoder().encode(`${header}.${payload}`));
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, data);

  return `${header}.${payload}.${b64url(sig)}`;
}

/**
 * Verifica e decodifica um JWT.
 * Retorna o payload se válido, null caso contrário (assinatura inválida, expirado, malformado).
 */
export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, payload, sig] = parts as [string, string, string];
    const data = toArrayBuffer(new TextEncoder().encode(`${header}.${payload}`));
    const key = await importKey(secret);

    const valid = await crypto.subtle.verify("HMAC", key, toArrayBuffer(b64urlDecode(sig)), data);
    if (!valid) return null;

    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as JwtPayload;
    if (Date.now() / 1000 > claims.exp) return null;

    return claims;
  } catch {
    return null;
  }
}
