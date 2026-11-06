import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import webpush from "web-push";

export interface VercelRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  cookies?: Record<string, string>;
  query?: Record<string, string | string[] | undefined>;
}

export interface VercelResponse {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  end(): void;
}

export const sendJson = (res: VercelResponse, code: number, body: unknown) => {
  res.status(code).json(body);
};

export function readBody(req: VercelRequest): Record<string, unknown> {
  const b = req.body;
  if (b && typeof b === "object") return b as Record<string, unknown>;
  if (typeof b === "string") {
    try {
      return JSON.parse(b);
    } catch {
      return {};
    }
  }
  return {};
}

const COOKIE_NAME = "fims_dash";
const COOKIE_MAX_AGE = 180 * 24 * 3600; // 180 days

const sha256 = (s: string) => createHash("sha256").update(s).digest();

export function serverConfigured(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD && process.env.AUTH_SECRET);
}

export function passwordOk(input: unknown): boolean {
  const expected = process.env.DASHBOARD_PASSWORD ?? "";
  if (!expected || typeof input !== "string") return false;
  return timingSafeEqual(sha256(input), sha256(expected));
}

const hmac = (value: string) => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return createHmac("sha256", secret).update(value).digest("base64url");
};

export function sessionCookie(): string {
  const exp = String(Date.now() + COOKIE_MAX_AGE * 1000);
  return `${exp}.${hmac(exp)}`;
}

export function clearedCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function sessionSetCookie(): string {
  return `${COOKIE_NAME}=${sessionCookie()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

function cookieValue(req: VercelRequest): string | null {
  const header = req.headers.cookie;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE_NAME) return v.join("=");
  }
  return null;
}

export function isAuthed(req: VercelRequest): boolean {
  if (!serverConfigured()) return false;
  const raw = cookieValue(req);
  if (!raw) return false;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return false;
  const exp = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = hmac(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  if (isAuthed(req)) return true;
  sendJson(res, 401, { error: "unauthorized" });
  return false;
}

let vapidReady = false;
export function vapidPublicKey(): string | null {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return null;
  if (!vapidReady) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:flodef@pm.me", pub, priv);
    vapidReady = true;
  }
  return pub;
}

export async function sendPush(title: string, body: string, url = "/"): Promise<{ sent: number; removed: number }> {
  const { pushSubsAll, pushSubsRemove } = await import("../src/lib/storage");
  const subs = await pushSubsAll();
  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async raw => {
      try {
        const sub = JSON.parse(raw);
        await webpush.sendNotification(sub, JSON.stringify({ title, body, url }));
        sent++;
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404 || code === 410) {
          await pushSubsRemove(raw);
          removed++;
        }
      }
    }),
  );
  return { sent, removed };
}
