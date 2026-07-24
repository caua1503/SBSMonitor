import { createDatabase } from "./db/index.ts";
import { createRouter } from "./router.ts";
import { registerV1Routes } from "./api/v1/index.ts";
import { SERVER_CONFIG } from "./config.ts";

const db = createDatabase();
const router = createRouter();

registerV1Routes(router, db);

// Rota de Health Check global declarada no index principal
router.add("GET", "/health", async () => {
  try {
    await db.agents.list();
    return Response.json({ ok: true, data: { status: "healthy", database: "connected" } });
  } catch (e) {
    return Response.json({ ok: false, error: "database disconnected" }, { status: 500 });
  }
});

const server = Bun.serve({
  hostname: SERVER_CONFIG.host,
  port: SERVER_CONFIG.port,
  async fetch(req) {
    const url = new URL(req.url);
    
    // Tratamento de CORS Preflight (OPTIONS)
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Rotas de API e Health Check são processadas pelo roteador
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
      const response = await router.handle(req);
      const corsResponse = new Response(response.body, response);
      corsResponse.headers.set("Access-Control-Allow-Origin", "*");
      corsResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
      corsResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return corsResponse;
    }

    // Servir o arquivo da interface web compilado
    try {
      const file = Bun.file("./dist/index.html");
      if (await file.exists()) {
        return new Response(file, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        });
      }
    } catch (e) {
      console.error("[Server] Error serving index.html:", e);
    }

    return new Response("SBSMonitor Dashboard - Frontend não compilado. Execute 'bun run build:web'.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
});

console.log(`[Server] Listening on http://${server.hostname}:${server.port}`);
console.log(`[Health Check] Listening on http://${server.hostname}:${server.port}/health`);

// Graceful shutdown — fecha DB antes de encerrar
const shutdown = (): void => {
  console.log("[Server] Shutting down...");
  server.stop();
  db.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);