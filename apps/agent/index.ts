import { AGENT_CONFIG } from "./config.ts";
import { collectCpu } from "./collectors/cpu.ts";
import { collectMemory } from "./collectors/memory.ts";
import { collectDisk } from "./collectors/disk.ts";
import { collectNetwork } from "./collectors/network.ts";
import { collectProcesses } from "./collectors/process.ts";
import { registerAgent, sendMetrics, type CollectedMetrics } from "./http/client.ts";

/** Executa todos os coletores em paralelo onde possível */
async function collectAll(): Promise<CollectedMetrics> {
  const [cpu, disk, system] = await Promise.all([
    collectCpu(),
    collectDisk(),
    collectProcesses(),
  ]);
  // Síncronos — executados após os assíncronos para não bloquear
  const memory = collectMemory();
  const network = collectNetwork();

  return {
    cpu,
    memory,
    disk,
    network,
    system,
    collected_at: new Date().toISOString(),
  };
}

async function cycle(): Promise<void> {
  const metrics = await collectAll();
  // console.log(`[Agent] Collected metrics:`, JSON.stringify(metrics, null, 2));
  await sendMetrics(metrics);
}

async function run(): Promise<void> {
  console.log(`[Agent] Starting — ID: ${AGENT_CONFIG.agentId} | Server: ${AGENT_CONFIG.serverUrl} | Interval: ${AGENT_CONFIG.collectInterval}s`);

  // Registro no startup — não fatal; o Server pode estar temporariamente offline
  try {
    await registerAgent();
  } catch (err) {
    console.error("[Agent] Registration failed:", (err as Error).message);
    console.warn("[Agent] Continuing — metrics may be rejected until registration succeeds");
  }

  // Primeiro ciclo imediato
  try {
    await cycle();
  } catch (err) {
    console.error("[Agent] Initial cycle failed:", (err as Error).message);
  }

  // Loop periódico
  const intervalHandle = setInterval(async () => {
    try {
      await cycle();
    } catch (err) {
      console.error("[Agent] Cycle failed:", (err as Error).message);
    }
  }, AGENT_CONFIG.collectInterval * 1000);

  // Graceful shutdown
  const shutdown = (): void => {
    console.log("[Agent] Shutting down...");
    clearInterval(intervalHandle);
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

run().catch(err => {
  console.error("[Agent] Fatal error:", err);
  process.exit(1);
});