import { clearedCookie, sendJson, type VercelRequest, type VercelResponse } from "./_lib.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" });
  res.setHeader("Set-Cookie", clearedCookie());
  sendJson(res, 200, { ok: true });
}
