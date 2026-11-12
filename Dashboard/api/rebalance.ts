import { readBody, requireAuth, sendJson, type VercelRequest, type VercelResponse } from "./_lib.js";
import { buildAction, planAction, sendAction } from "../src/lib/rebalance/server.js";
import type { PlanStage } from "../src/lib/rebalance/plan.js";

export const config = { maxDuration: 60 };

const isStage = (s: unknown): s is PlanStage => {
  if (!s || typeof s !== "object") return false;
  const t = (s as { type?: string }).type;
  return t === "lend" || t === "kamino-withdraw" || t === "swap" || t === "kamino-deposit";
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  if (!requireAuth(req, res)) return;
  const body = readBody(req);
  const action = body.action;
  try {
    if (action === "plan") {
      return sendJson(res, 200, await planAction());
    }
    if (action === "build") {
      if (!isStage(body.stage)) {
        return sendJson(res, 400, { error: "bad stage" });
      }
      const out = await buildAction(body.stage);
      return sendJson(res, 200, { txs: Array.isArray(out) ? out : [out] });
    }
    if (action === "send") {
      const tx = body.tx;
      if (typeof tx !== "string") return sendJson(res, 400, { error: "bad tx" });
      return sendJson(res, 200, await sendAction(tx));
    }
    return sendJson(res, 400, { error: "unknown action" });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return sendJson(res, status, { error: String(e?.message ?? e) });
  }
}
