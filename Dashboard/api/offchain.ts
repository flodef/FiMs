import { dbReady, offchainSet } from "../src/lib/storage.js";
import { validateOffchain } from "../src/lib/offchain.js";
import { readBody, requireAuth, sendJson, type VercelRequest, type VercelResponse } from "./_lib.js";

export const maxDuration = 10;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PUT") return sendJson(res, 405, { error: "method not allowed" });
  if (!requireAuth(req, res)) return;
  if (!dbReady()) return sendJson(res, 503, { error: "storage not configured" });

  const v = validateOffchain(readBody(req));
  if (!v.ok) return sendJson(res, 400, { error: v.error });
  try {
    await offchainSet(v.data);
    return sendJson(res, 200, { ok: true, offchain: v.data });
  } catch {
    return sendJson(res, 500, { error: "save failed" });
  }
}
