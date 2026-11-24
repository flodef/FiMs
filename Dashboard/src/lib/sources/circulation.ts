const TIMEOUT_MS = 5000;

export interface CirculationBucket {
  members: number;
  tontine: number;
  total: number;
}

/** GET /fims/circulation on Wallet-V3 — member token counts from the ledger. */
export interface CirculationData {
  computedAt: string;
  FSOL: CirculationBucket;
  FiMs: CirculationBucket;
  FLiP: CirculationBucket;
}

const bucketOk = (b: unknown): b is CirculationBucket =>
  typeof b === "object" &&
  b !== null &&
  ["members", "tontine", "total"].every(k => Number.isFinite((b as Record<string, unknown>)[k]));

/**
 * Member circulation counts (FSOL / FiMs / FLiP held by members + tontine).
 * Throws on HTTP/parse/validation failure — callers treat it as best-effort
 * and keep the sheet FiMsData values as fallback.
 */
export async function fetchCirculation(url: string): Promise<CirculationData> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`circulation → HTTP ${res.status}`);
  const body = (await res.json()) as Partial<CirculationData>;
  if (!bucketOk(body?.FSOL) || !bucketOk(body?.FiMs) || !bucketOk(body?.FLiP)) {
    throw new Error("circulation validation failed");
  }
  return body as CirculationData;
}
