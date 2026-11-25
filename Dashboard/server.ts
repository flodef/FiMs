/**
 * Railway/Node entrypoint: serves the built SPA (dist/) and adapts the
 * Vercel-style api/*.ts handlers to plain node:http. Replaces the Vercel
 * serverless layer — same routes, same request/response contract.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import cron from "./api/cron.js";
import configApi from "./api/config.js";
import dashboard from "./api/dashboard.js";
import login from "./api/login.js";
import logout from "./api/logout.js";
import offchain from "./api/offchain.js";
import positions from "./api/positions.js";
import pushSubscribe from "./api/push/subscribe.js";
import rebalance from "./api/rebalance.js";
import type { VercelRequest, VercelResponse } from "./api/_lib.js";

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

const routes: Record<string, Handler> = {
  "/api/config": configApi,
  "/api/login": login,
  "/api/logout": logout,
  "/api/dashboard": dashboard,
  "/api/cron": cron,
  "/api/offchain": offchain,
  "/api/positions": positions,
  "/api/rebalance": rebalance,
  "/api/push/subscribe": pushSubscribe,
};

const DIST = fileURLToPath(new URL("./dist/", import.meta.url));

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      const type = String(req.headers["content-type"] ?? "");
      if (type.includes("application/json")) {
        try {
          return resolve(JSON.parse(raw));
        } catch {
          return resolve(raw);
        }
      }
      resolve(raw);
    });
    req.on("error", reject);
  });
}

function parseQuery(search: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of new URLSearchParams(search)) {
    const prev = out[k];
    if (prev === undefined) out[k] = v;
    else if (Array.isArray(prev)) prev.push(v);
    else out[k] = [prev, v];
  }
  return out;
}

function adaptRes(res: ServerResponse): VercelResponse {
  let status = 200;
  const headers = new Map<string, string>();
  let sent = false;
  const flush = (body?: string) => {
    if (sent) return;
    sent = true;
    for (const [k, v] of headers) res.setHeader(k, v);
    res.statusCode = status;
    res.end(body);
  };
  const out: VercelResponse = {
    status(code: number) {
      status = code;
      return out;
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    json(body: unknown) {
      if (!headers.has("content-type")) headers.set("content-type", "application/json; charset=utf-8");
      flush(JSON.stringify(body));
    },
    end() {
      flush();
    },
  };
  return out;
}

async function serveApi(pathname: string, req: IncomingMessage, res: ServerResponse) {
  const handler = routes[pathname];
  const vres = adaptRes(res);
  if (!handler) {
    vres.status(404).json({ error: "not found" });
    return;
  }
  try {
    const body = await readBody(req);
    const url = new URL(req.url ?? "/", "http://localhost");
    const vreq: VercelRequest = {
      method: req.method,
      url: pathname,
      headers: req.headers,
      body,
      query: parseQuery(url.search),
    };
    await handler(vreq, vres);
  } catch (e) {
    console.error(`[api] ${pathname} failed:`, e);
    if (!res.headersSent) vres.status(500).json({ error: "internal error" });
    else res.end();
  }
}

async function serveStatic(pathname: string, method: string, res: ServerResponse) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  const file = join(DIST, rel);
  if (!file.startsWith(DIST)) {
    res.statusCode = 403;
    res.end();
    return;
  }
  try {
    const data = await readFile(file);
    res.setHeader("content-type", MIME[extname(file)] ?? "application/octet-stream");
    res.setHeader("cache-control", file.includes("assets/") ? "public, max-age=31536000, immutable" : "no-cache");
    res.end(data);
  } catch {
    // SPA fallback: client-side routes get index.html
    if (method === "GET" && !extname(pathname)) {
      try {
        const html = await readFile(join(DIST, "index.html"));
        res.setHeader("content-type", "text/html; charset=utf-8");
        res.setHeader("cache-control", "no-cache");
        res.end(html);
        return;
      } catch {
        /* dist missing */
      }
    }
    res.statusCode = 404;
    res.end("not found");
  }
}

const port = Number(process.env.PORT) || 3000;
createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (pathname.startsWith("/api/")) return void serveApi(pathname, req, res);
  void serveStatic(pathname, req.method ?? "GET", res);
}).listen(port, "0.0.0.0", () => {
  console.log(`fims-dashboard listening on :${port}`);
});
