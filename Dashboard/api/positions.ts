import {
  dbReady,
  trackedCreate,
  trackedDelete,
  trackedList,
  trackedUpdate,
  type TrackedInput,
} from "../src/lib/storage.js";
import type { TrackedKind } from "../src/lib/types.js";
import { readBody, requireAuth, sendJson, type VercelRequest, type VercelResponse } from "./_lib.js";

export const maxDuration = 15;

const KINDS = new Set<TrackedKind>(["manual", "jupiter", "kamino"]);
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TOKENS_RE = /^[A-Za-z0-9]+(,[A-Za-z0-9]+)*$/;

function validate(body: Record<string, unknown>): { ok: true; data: TrackedInput } | { ok: false; error: string } {
  const kind = body.kind;
  if (typeof kind !== "string" || !KINDS.has(kind as TrackedKind)) {
    return { ok: false, error: "kind must be manual|jupiter|kamino" };
  }
  const str = (k: string) => {
    const v = body[k];
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const data: TrackedInput = {
    kind: kind as TrackedKind,
    label: str("label"),
    platform: str("platform"),
    wallet: str("wallet"),
    tokens: str("tokens"),
    asset: str("asset"),
    unit: str("unit"),
  };

  if (kind === "jupiter" || kind === "kamino") {
    if (!data.wallet || !B58.test(data.wallet)) {
      return { ok: false, error: "wallet must be a Solana base58 address (32-44 chars)" };
    }
    if (kind === "kamino" && (!data.tokens || !TOKENS_RE.test(data.tokens))) {
      return { ok: false, error: 'tokens must be a comma-separated list like "USDC,USDT"' };
    }
  }

  if (kind === "manual") {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "amount must be a finite number >= 0" };
    const apy = Number(body.apy);
    if (!Number.isFinite(apy)) return { ok: false, error: "apy must be a finite fraction" };
    if (!data.unit) return { ok: false, error: "unit required" };
    data.amount = amount;
    data.apy = apy;
  }

  return { ok: true, data };
}

const bodyId = (req: VercelRequest, body: Record<string, unknown>): number | null => {
  const raw = body.id ?? req.query?.id;
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;
  if (!dbReady()) return sendJson(res, 503, { error: "storage not configured" });

  if (req.method === "GET") {
    return sendJson(res, 200, { positions: await trackedList() });
  }

  const body = readBody(req);

  if (req.method === "POST") {
    const v = validate(body);
    if (!v.ok) return sendJson(res, 400, { error: v.error });
    try {
      const id = await trackedCreate(v.data);
      return id == null ? sendJson(res, 500, { error: "insert failed" }) : sendJson(res, 201, { id });
    } catch {
      return sendJson(res, 500, { error: "insert failed" });
    }
  }

  if (req.method === "PUT") {
    const id = bodyId(req, body);
    if (id == null) return sendJson(res, 400, { error: "id required" });
    const v = validate(body);
    if (!v.ok) return sendJson(res, 400, { error: v.error });
    try {
      return (await trackedUpdate(id, v.data))
        ? sendJson(res, 200, { ok: true })
        : sendJson(res, 404, { error: "not found" });
    } catch {
      return sendJson(res, 500, { error: "update failed" });
    }
  }

  if (req.method === "DELETE") {
    const id = bodyId(req, body);
    if (id == null) return sendJson(res, 400, { error: "id required" });
    try {
      return (await trackedDelete(id)) ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: "not found" });
    } catch {
      return sendJson(res, 500, { error: "delete failed" });
    }
  }

  sendJson(res, 405, { error: "method not allowed" });
}
