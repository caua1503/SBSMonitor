import { totalmem, freemem } from "node:os";
import type { MemoryMetrics } from "@repo/shared/types";

/** Síncrono — node:os retorna valores instantâneos sem I/O */
export function collectMemory(): MemoryMetrics {
  const total = totalmem();
  const free = freemem();
  const used = total - free;

  return {
    total_bytes: total,
    used_bytes: used,
    free_bytes: free,
    used_percentage: parseFloat((total > 0 ? (used / total) * 100 : 0).toFixed(2)),
  };
}
