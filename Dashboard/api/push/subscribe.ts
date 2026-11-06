import { pushSubsAdd, pushSubsAll, pushSubsRemove } from "../../src/lib/storage";
import { readBody, requireAuth, sendJson, type VercelRequest, type VercelResponse } from "../_lib";

export const maxDuration = 15;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return;
  const body = readBody(req);

  if (req.method === "POST") {
    const sub = body.subscription;
    if (!sub || typeof sub !== "object" || typeof (sub as any).endpoint !== "string") {
      return sendJson(res, 400, { error: "subscription.endpoint required" });
    }
    await pushSubsAdd(JSON.stringify(sub));
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "DELETE") {
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
    if (!endpoint) return sendJson(res, 400, { error: "endpoint required" });
    const subs = await pushSubsAll();
    for (const raw of subs) {
      try {
        if (JSON.parse(raw)?.endpoint === endpoint) await pushSubsRemove(raw);
      } catch {
        // skip malformed
      }
    }
    return sendJson(res, 200, { ok: true });
  }

  sendJson(res, 405, { error: "method not allowed" });
}
