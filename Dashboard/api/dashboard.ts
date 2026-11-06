import { fetchInputs } from "../src/lib/server.js";
import { sendJson, requireAuth, type VercelRequest, type VercelResponse } from "./_lib.js";

export const maxDuration = 30;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "method not allowed" });
  if (!requireAuth(req, res)) return;
  try {
    const inputs = await fetchInputs();
    sendJson(res, 200, inputs);
  } catch (e) {
    sendJson(res, 500, { error: e instanceof Error ? e.message : "fetch failed" });
  }
}
