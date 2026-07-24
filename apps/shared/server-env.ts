export interface ServerEnv {
  host: string;
  port: number;
  /** Caminho do arquivo SQLite ou connection string futura do PostgreSQL */
  databaseUrl: string;
  /** Segredo HMAC para assinar tokens JWT do painel administrativo */
  jwtSecret: string;
  /** URL da API do WhatsApp */
  WhatsappApiUrl?: string;
  WhatsappApiToken?: string;
  /** Grupo que recebe alertas de métricas */
  whatsappAlertGroupId?: string;
  alertThresholds: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

function readPercentageEnv(name: string, fallback: number): number {
  const raw = Bun.env[name];
  const value = raw === undefined || raw === "" ? fallback : Number(raw);

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${name} must be a number between 0 and 100`);
  }

  return value;
}

export function loadServerEnv(): ServerEnv {
  return {
    host: Bun.env["SERVER_HOST"] ?? "0.0.0.0",
    port: Number(Bun.env["SERVER_PORT"] ?? "3000"),
    databaseUrl: Bun.env["DATABASE_URL"] ?? "./data/sbsmonitor.db",
    jwtSecret: Bun.env["JWT_SECRET"] ?? "dev-secret-change-in-production",
    WhatsappApiUrl: Bun.env["WHATSAPP_API_URL"] ?? undefined,
    WhatsappApiToken: Bun.env["WHATSAPP_API_TOKEN"] ?? undefined,
    whatsappAlertGroupId: Bun.env["WHATSAPP_ALERT_GROUP_ID"] ?? undefined,
    alertThresholds: {
      cpu: readPercentageEnv("ALERT_CPU_THRESHOLD_PCT", 90),
      memory: readPercentageEnv("ALERT_MEMORY_THRESHOLD_PCT", 90),
      disk: readPercentageEnv("ALERT_DISK_THRESHOLD_PCT", 90),
    },
  };
}
