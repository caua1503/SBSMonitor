import type { Database } from "../../db/index.ts";
import type { Router } from "../../router.ts";
import { handleLogin } from "./auth/login.ts";
import { handleAdminCreateAgent } from "./admin/create-agent.ts";
import { handleAdminDeleteAgent } from "./admin/delete-agent.ts";
import { handleRegister } from "./agents/register.ts";
import { handleHeartbeat } from "./agents/heartbeat.ts";
import { handleMetrics } from "./agents/metrics.ts";
import { handleListAgents } from "./agents/list.ts";
import { handleGetAgent } from "./agents/get.ts";
import { handleGetAgentMetrics } from "./agents/get-metrics.ts";
import { requireAdminAuth } from "../../middleware/auth.ts";

/** Registra todas as rotas da API v1 no router */
export function registerV1Routes(router: Router, db: Database): void {
  // Autenticação (pública)
  router.add("POST", "/api/v1/auth/login", (req) => handleLogin(req));

  // Rotas administrativas de gestão — requerem JWT Bearer
  router.add("POST", "/api/v1/admin/agents", async (req) => {
    const denied = await requireAdminAuth(req);
    if (denied) return denied;
    return handleAdminCreateAgent(req, db);
  });

  router.add("DELETE", "/api/v1/admin/agents/:id", async (req, params) => {
    const denied = await requireAdminAuth(req);
    if (denied) return denied;
    return handleAdminDeleteAgent(req, params, db);
  });

  // Rotas de agent — autenticadas via X-Agent-ID + X-Agent-Secret
  router.add("POST", "/api/v1/agents/register",  (req) => handleRegister(req, db));
  router.add("POST", "/api/v1/agents/heartbeat", (req) => handleHeartbeat(req, db));
  router.add("POST", "/api/v1/agents/metrics",   (req) => handleMetrics(req, db));

  // Rotas administrativas — requerem JWT Bearer
  router.add("GET", "/api/v1/agents", async (req) => {
    const denied = await requireAdminAuth(req);
    if (denied) return denied;
    return handleListAgents(req, db);
  });

  router.add("GET", "/api/v1/agents/:id", async (req, params) => {
    const denied = await requireAdminAuth(req);
    if (denied) return denied;
    return handleGetAgent(req, params, db);
  });

  router.add("GET", "/api/v1/agents/:id/metrics", async (req, params) => {
    const denied = await requireAdminAuth(req);
    if (denied) return denied;
    return handleGetAgentMetrics(req, params, db);
  });
}


