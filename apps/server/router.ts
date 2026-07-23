type Handler = (req: Request, params: Record<string, string>) => Promise<Response>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: Handler;
}

export type Router = ReturnType<typeof createRouter>;

/** Router minimalista — sem framework externo */
export function createRouter() {
  const routes: Route[] = [];

  function add(method: string, path: string, handler: Handler): void {
    const paramNames: string[] = [];
    const regexStr = path.replace(/:([^/]+)/g, (_, name: string) => {
      paramNames.push(name);
      return "([^/]+)";
    });
    routes.push({
      method: method.toUpperCase(),
      pattern: new RegExp(`^${regexStr}$`),
      paramNames,
      handler,
    });
  }

  async function handle(req: Request): Promise<Response> {
    const pathname = new URL(req.url).pathname;

    for (const route of routes) {
      if (route.method !== req.method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;

      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1]!;
      });

      return route.handler(req, params);
    }

    return err("Not Found", 404);
  }

  return { add, handle };
}

// --- Response helpers ---

export function ok<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data }, { status });
}

export function err(message: string, status = 400): Response {
  return Response.json({ ok: false, error: message }, { status });
}
