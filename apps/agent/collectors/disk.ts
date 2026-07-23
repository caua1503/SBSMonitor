import { statfs } from "node:fs/promises";
import { platform } from "node:os";
import type { DiskMetrics } from "@repo/shared/types";

/** Retorna estatísticas do disco raiz do sistema */
export async function collectDisk(): Promise<DiskMetrics> {
  const root = platform() === "win32" ? "C:\\" : "/";
  const stat = await statfs(root);

  const blockSize = BigInt(stat.bsize);
  const total = Number(BigInt(stat.blocks) * blockSize);
  const free = Number(BigInt(stat.bavail) * blockSize);
  const used = total - free;

  return {
    total_bytes: total,
    used_bytes: used,
    free_bytes: free,
    used_percentage: parseFloat((total > 0 ? (used / total) * 100 : 0).toFixed(2)),
  };
}
