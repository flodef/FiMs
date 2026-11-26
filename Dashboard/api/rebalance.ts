import { readBody, requireAuth, sendJson, type VercelRequest, type VercelResponse } from "./_lib.js";
import {
  buildAction,
  cardBalancesAction,
  planAction,
  restorePlanAction,
  sendAction,
  statusAction,
  topupPlanAction,
} from "../src/lib/rebalance/server.js";
import type { PlanStage, RestoreSource, RestoreTarget } from "../src/lib/rebalance/plan.js";

export const config = { maxDuration: 60 };

const isStage = (s: unknown): s is PlanStage => {
  if (!s || typeof s !== "object") return false;
  const t = (s as { type?: string }).type;
  return (
    t === "lend" ||
    t === "kamino-withdraw" ||
    t === "swap" ||
    t === "kamino-deposit" ||
    t === "spend-transfer" ||
    t === "swap-any" ||
    t === "lend-collateral" ||
    t === "earn-deposit" ||
    t === "earn-withdraw"
  );
};

const RESTORE_TARGETS = new Set(["jupsol", "eurc", "usd", "jlp"]);
const RESTORE_SOURCES = new Set(["kamino", "lend"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "POST only" });
  if (!requireAuth(req, res)) return;
  const body = readBody(req);
  const action = body.action;
  try {
    if (action === "plan") {
      return sendJson(res, 200, await planAction());
    }
    if (action === "topup-plan") {
      const usdt = Number(body.usdt);
      if (!Number.isFinite(usdt)) return sendJson(res, 400, { error: "bad usdt" });
      const source = body.source === "lend" ? "lend" : "kamino";
      const slippageBps = Number.isFinite(Number(body.slippageBps)) ? Number(body.slippageBps) : undefined;
      const card = body.card === "nexo" ? "nexo" : "jupiter";
      return sendJson(res, 200, await topupPlanAction(usdt, source, slippageBps, card));
    }
    if (action === "card-balances") {
      return sendJson(res, 200, await cardBalancesAction());
    }
    if (action === "restore-plan") {
      const target = String(body.target ?? "") as RestoreTarget;
      const source = String(body.source ?? "") as RestoreSource;
      const amount = Number(body.amount);
      if (!RESTORE_TARGETS.has(target) || !RESTORE_SOURCES.has(source)) {
        return sendJson(res, 400, { error: "bad target/source" });
      }
      if (!Number.isFinite(amount)) return sendJson(res, 400, { error: "bad amount" });
      const direction = body.direction === "sell" ? "sell" : "buy";
      const slippageBps = Number.isFinite(Number(body.slippageBps)) ? Number(body.slippageBps) : undefined;
      return sendJson(res, 200, await restorePlanAction(target, source, amount, direction, slippageBps));
    }
    if (action === "build") {
      if (!isStage(body.stage)) {
        return sendJson(res, 400, { error: "bad stage" });
      }
      const out = await buildAction(body.stage);
      return sendJson(res, 200, { txs: Array.isArray(out) ? out : [out] });
    }
    if (action === "send") {
      return sendJson(res, 200, await sendAction(body.tx));
    }
    if (action === "status") {
      return sendJson(res, 200, await statusAction(body.tx));
    }
    return sendJson(res, 400, { error: "unknown action" });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    return sendJson(res, status, { error: String(e?.message ?? e) });
  }
}
