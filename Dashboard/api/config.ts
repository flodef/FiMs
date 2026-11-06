import { sendJson, vapidPublicKey, type VercelRequest, type VercelResponse } from "./_lib";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  sendJson(res, 200, { vapidPublicKey: vapidPublicKey() });
}
