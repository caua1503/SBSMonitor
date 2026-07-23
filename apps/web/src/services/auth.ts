const TOKEN_KEY = "sbsmonitor_admin_token";
const EXPIRES_KEY = "sbsmonitor_admin_expires";

export interface LoginResult {
  token: string;
  expiresAt: number;
}

const getBaseUrl = (): string => {
  if (typeof window !== "undefined" && window.location.protocol === "file:") {
    return "http://localhost:3000";
  }
  return "";
};

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (res.status === 401) throw new Error("Credenciais inválidas");
  if (!res.ok) throw new Error("Erro ao conectar com o servidor");

  const json = (await res.json()) as { ok: boolean; data?: LoginResult; error?: string };
  if (!json.ok || !json.data) throw new Error(json.error || "Erro desconhecido");

  localStorage.setItem(TOKEN_KEY, json.data.token);
  localStorage.setItem(EXPIRES_KEY, String(json.data.expiresAt));
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);
  const expires = localStorage.getItem(EXPIRES_KEY);
  if (!token || !expires) return false;
  return Date.now() < Number(expires);
}
