import { readdir } from "node:fs/promises";
import { platform } from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { SystemMetrics } from "@repo/shared/types";

const execAsync = promisify(exec);

/**
 * Conta processos em execução via /proc no Linux.
 * Usa tasklist no Windows.
 */
export async function collectProcesses(): Promise<SystemMetrics> {
  const osPlatform = platform();

  if (osPlatform === "linux") {
    try {
      const entries = await readdir("/proc");
      const count = entries.filter(e => /^\d+$/.test(e)).length;
      return { process_count: count };
    } catch {
      return { process_count: 0 };
    }
  }

  if (osPlatform === "win32") {
    try {
      // /NH remove o cabeçalho, FO CSV força csv, contagem manual ou regex
      const { stdout } = await execAsync('tasklist /NH | find /V /C ""');
      const count = parseInt(stdout.trim(), 10);
      return { process_count: isNaN(count) ? 0 : count };
    } catch {
      return { process_count: 0 };
    }
  }

  return { process_count: 0 };
}
