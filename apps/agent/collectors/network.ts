import { networkInterfaces } from "node:os";
import type { NetworkMetrics } from "@repo/shared/types";

/** Retorna o primeiro IP IPv4 não-loopback encontrado nas interfaces de rede */
export function collectNetwork(): NetworkMetrics {
  const ifaces = networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    for (const addr of iface ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        return { ip: addr.address };
      }
    }
  }
  return { ip: "127.0.0.1" };
}
