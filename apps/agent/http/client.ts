import { hostname, platform } from "node:os";
import { AGENT_CONFIG } from "../config.ts";
import { authHeaders } from "./auth.ts";
import { collectNetwork } from "../collectors/network.ts";
import type { MetricsPayload, RegisterPayload } from "@repo/shared/types";

export type CollectedMetrics = Omit<MetricsPayload, "agent_id">;

/** Envia POST autenticado ao Server; lança erro em caso de falha HTTP ou timeout */
async function post(path: string, body: unknown): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AGENT_CONFIG.requestTimeout);

  try {
    const res = await fetch(`${AGENT_CONFIG.serverUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "unknown" })) as { error?: string };
      throw new Error(`HTTP ${res.status}: ${data.error ?? "unknown"}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Registra o Agent no Server — idempotente, pode ser chamado em todo startup */
export async function registerAgent(): Promise<void> {
  const { ip } = collectNetwork();
  const payload: RegisterPayload = {
    hostname: hostname(),
    platform: platform(),
    ip,
  };
  await post("/api/v1/agents/register", payload);
  console.log("[Agent] Registered");
}

/** Envia o pacote de métricas coletadas */
export async function sendMetrics(metrics: CollectedMetrics): Promise<void> {
  const payload: MetricsPayload = {
    ...metrics,
    agent_id: AGENT_CONFIG.agentId,
  };
  await post("/api/v1/agents/metrics", payload);
  console.log(`[Agent] Metrics sent — ${metrics.collected_at}`);
}
