import type { MetricsPayload } from "@repo/shared/types";
import { SERVER_CONFIG } from "./config.ts";
import type { AlertMetricName, Database } from "./db/index.ts";
import { WhatsappService } from "./whatsapp.service.ts";

interface MetricCheck {
  metric: AlertMetricName;
  label: string;
  value: number;
  threshold: number;
}

const whatsapp = new WhatsappService();
let warnedMissingWhatsappConfig = false;

function getChecks(payload: MetricsPayload): MetricCheck[] {
  return [
    {
      metric: "cpu",
      label: "CPU",
      value: payload.cpu.used_percentage,
      threshold: SERVER_CONFIG.alertThresholds.cpu,
    },
    {
      metric: "memory",
      label: "RAM",
      value: payload.memory.used_percentage,
      threshold: SERVER_CONFIG.alertThresholds.memory,
    },
    {
      metric: "disk",
      label: "Disco",
      value: payload.disk.used_percentage,
      threshold: SERVER_CONFIG.alertThresholds.disk,
    },
  ];
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function buildAlertMessage(input: {
  agentId: string;
  hostname: string;
  ip: string;
  checks: MetricCheck[];
  collectedAt: string;
}): string {
  return [
    "Alerta SBSMonitor",
    `Agente: ${input.hostname} (${input.agentId})`,
    `IP: ${input.ip}`,
    `Horario: ${input.collectedAt}`,
    "",
    "Metricas acima do limite:",
    ...input.checks.map(
      (check) =>
        `${check.label}: ${formatPercentage(check.value)} >= ${formatPercentage(check.threshold)}`
    ),
  ].join("\n");
}

function warnMissingWhatsappConfig(): void {
  if (warnedMissingWhatsappConfig) return;
  warnedMissingWhatsappConfig = true;
  console.warn(
    "[Alerts] WhatsApp alerts disabled: configure WHATSAPP_API_URL, WHATSAPP_API_TOKEN and WHATSAPP_ALERT_GROUP_ID."
  );
}

async function handleRecoveredMetric(
  db: Database,
  agentId: string,
  check: MetricCheck,
  at: number
): Promise<void> {
  const state = await db.alerts.find(agentId, check.metric);
  if (!state?.active) return;

  await db.alerts.markRecovered(agentId, check.metric, check.value, check.threshold, at);
  console.log(
    `[Alerts] ${check.label} normalized for ${agentId}: ${formatPercentage(check.value)} < ${formatPercentage(check.threshold)}`
  );
}

async function getPendingCriticalMetric(
  db: Database,
  agentId: string,
  check: MetricCheck
): Promise<MetricCheck | null> {
  const state = await db.alerts.find(agentId, check.metric);
  return state?.active ? null : check;
}

async function sendCriticalMetricAlerts(
  db: Database,
  agentId: string,
  payload: MetricsPayload,
  checks: MetricCheck[],
  at: number
): Promise<void> {
  if (checks.length === 0) return;

  const groupId = SERVER_CONFIG.whatsappAlertGroupId;
  if (!whatsapp.isConfigured || !groupId) {
    warnMissingWhatsappConfig();
    return;
  }

  const agent = await db.agents.findById(agentId);
  const message = buildAlertMessage({
    agentId,
    hostname: agent?.hostname ?? agentId,
    ip: payload.network.ip || agent?.ip || "desconhecido",
    checks,
    collectedAt: new Date(payload.collected_at).toISOString(),
  });

  try {
    await whatsapp.sendMessage(groupId, message);
    for (const check of checks) {
      await db.alerts.markActive({
        agentId,
        metric: check.metric,
        lastValue: check.value,
        threshold: check.threshold,
        lastTriggeredAt: at,
        updatedAt: at,
      });
    }
    console.log(
      `[Alerts] Sent alert for ${agentId}: ${checks.map((check) => check.label).join(", ")}`
    );
  } catch (error) {
    console.error(`[Alerts] Failed to send alert for ${agentId}:`, error);
  }
}

export async function evaluateMetricAlerts(
  db: Database,
  agentId: string,
  payload: MetricsPayload,
  receivedAt: number
): Promise<void> {
  const pendingCriticalChecks: MetricCheck[] = [];

  for (const check of getChecks(payload)) {
    if (check.value >= check.threshold) {
      const pending = await getPendingCriticalMetric(db, agentId, check);
      if (pending) pendingCriticalChecks.push(pending);
      continue;
    }

    await handleRecoveredMetric(db, agentId, check, receivedAt);
  }

  await sendCriticalMetricAlerts(db, agentId, payload, pendingCriticalChecks, receivedAt);
}
