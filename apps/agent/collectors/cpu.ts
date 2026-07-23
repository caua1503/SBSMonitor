import { cpus } from "node:os";
import type { CpuMetrics } from "@repo/shared/types";

function getTicks(): { idle: number; total: number } {
  const list = cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of list) {
    const { user, nice, sys, idle: cpuIdle, irq } = cpu.times;
    idle += cpuIdle;
    total += user + nice + sys + cpuIdle + irq;
  }
  return { idle, total };
}

/**
 * Calcula uso de CPU por diferença de ticks em um intervalo de amostragem.
 * @param sampleMs Duração da amostra em ms (padrão: 100ms)
 */
export async function collectCpu(sampleMs = 100): Promise<CpuMetrics> {
  const start = getTicks();
  await Bun.sleep(sampleMs);
  const end = getTicks();

  const idleDiff = end.idle - start.idle;
  const totalDiff = end.total - start.total;
  const used = totalDiff === 0 ? 0 : (1 - idleDiff / totalDiff) * 100;

  return {
    used_percentage: parseFloat(used.toFixed(2)),
  };
}
