import {
  passwordOk,
  readBody,
  sendJson,
  serverConfigured,
  sessionSetCookie,
  type VercelRequest,
  type VercelResponse,
} from "./_lib.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" });
  if (!serverConfigured()) return sendJson(res, 500, { error: "server not configured" });
  const { password } = readBody(req);
  if (!passwordOk(password)) return sendJson(res, 401, { error: "invalid password" });
  res.setHeader("Set-Cookie", sessionSetCookie());
  sendJson(res, 200, { ok: true });
}
