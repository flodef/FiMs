import { createHash, timingSafeEqual } from "node:crypto";
import { computeDashboard, type AlertLevel } from "../src/lib/compute.js";
import { fetchInputs } from "../src/lib/server.js";
import { getAlertState, setAlertState } from "../src/lib/storage.js";
import { sendJson, sendPush, type VercelRequest, type VercelResponse } from "./_lib.js";

export const maxDuration = 60;

const DANGER_RESEND_MS = 60 * 60 * 1000;

interface AlertEntry {
  level: AlertLevel;
  lastSentAt: number;
}
type AlertState = Record<string, AlertEntry>;

const secretOk = (req: VercelRequest): boolean => {
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected) return false;
  const auth = req.headers.authorization;
  const bearer = Array.isArray(auth) ? auth[0] : auth;
  const header = req.headers["x-cron-secret"];
  const xcron = Array.isArray(header) ? header[0] : header;
  const provided = bearer?.startsWith("Bearer ") ? bearer.slice(7) : xcron;
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
};

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const shortAddr = (w?: string | null) => (w && w.length > 12 ? `${w.slice(0, 4)}…${w.slice(-4)}` : (w ?? ""));

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" });
  if (!secretOk(req)) return sendJson(res, 401, { error: "unauthorized" });

  const inputs = await fetchInputs();
  const result = computeDashboard(inputs, new Date());
  const now = Date.now();

  const prev: AlertState = (await getAlertState<AlertState>()) ?? {};
  const next: AlertState = {};
  const lines: string[] = [];
  const pushes: { title: string; body: string; sent: number; removed: number }[] = [];

  const extraMeta = new Map((inputs.extraPositions ?? []).map(e => [`${e.id}:${e.token}`, e]));

  for (const c of result.collaterals) {
    const key = `${c.id ?? "base"}:${c.token}`;
    const p = prev[key] ?? { level: "ok" as AlertLevel, lastSentAt: 0 };
    let triggered: "danger" | "warn" | null = null;
    if (c.level === "danger" && (p.level !== "danger" || now - p.lastSentAt >= DANGER_RESEND_MS)) triggered = "danger";
    else if (c.level === "warn" && p.level === "ok") triggered = "warn";

    if (triggered) {
      const liq = c.liqThreshold != null ? pct(c.liqThreshold) : "?";
      const em = c.id != null ? extraMeta.get(`${c.id}:${c.token}`) : undefined;
      const who = em ? ` (${em.label || shortAddr(em.wallet) || "tracked"})` : "";
      const body =
        triggered === "danger"
          ? `Bail out quick before the boat sink. ${c.token}${who}: LTV ${pct(c.ltv)} / liq ${liq}`
          : `${c.token}${who}: LTV ${pct(c.ltv)} > target ${c.target != null ? pct(c.target) : "?"} (liq ${liq})`;
      lines.push(`${triggered === "danger" ? "Loan is Under Water !" : "LTV above target"} — ${body}`);
      next[key] = { level: c.level, lastSentAt: now };
    } else {
      next[key] = { level: c.level, lastSentAt: p.lastSentAt };
    }
  }

  if (lines.length) {
    const danger = lines.some(l => l.startsWith("Loan is Under Water"));
    const title = danger ? "FiMs Loans — danger" : "FiMs Loans — warning";
    const r = await sendPush(title, lines.join("\n"));
    pushes.push({ title, body: lines.join("\n"), ...r });
  }

  const wasAlerting = Object.values(prev).some(e => e.level !== "ok");
  const allOk = result.collaterals.every(c => c.level === "ok");
  if (wasAlerting && allOk) {
    const r = await sendPush("FiMs Loans — back to OK", "All LTV back within targets.");
    pushes.push({ title: "FiMs Loans — back to OK", body: "All LTV back within targets.", ...r });
  }

  await setAlertState(next);

  sendJson(res, 200, {
    status: result.status,
    collaterals: result.collaterals,
    pushes,
    sources: inputs.sources,
  });
}
