/** Off-chain (non-custodial) token holdings counted in the live Total. */
export interface OffchainHoldings {
  xBTC: number;
  ZEC: number;
}

/** Sheet Wallet!G constants: xBTC row adds FiMsData!B18+0.00044489, ZEC row +0.92 (B18 empty → 0). */
export const DEFAULT_OFFCHAIN: OffchainHoldings = { xBTC: 0.00044489, ZEC: 0.92 };

const MAX_HOLDING = 1e9;

/** Strict body check for PUT /api/offchain: exactly {xBTC, ZEC}, finite, 0..1e9. */
export function validateOffchain(
  body: Record<string, unknown>,
): { ok: true; data: OffchainHoldings } | { ok: false; error: string } {
  const keys = Object.keys(body);
  if (keys.length !== 2 || !keys.includes("xBTC") || !keys.includes("ZEC")) {
    return { ok: false, error: "body must contain exactly xBTC and ZEC" };
  }
  const num = (k: "xBTC" | "ZEC"): number | null => {
    const v = Number(body[k]);
    return Number.isFinite(v) && v >= 0 && v <= MAX_HOLDING ? v : null;
  };
  const xBTC = num("xBTC");
  const ZEC = num("ZEC");
  if (xBTC == null || ZEC == null) {
    return { ok: false, error: "xBTC and ZEC must be finite numbers between 0 and 1e9" };
  }
  return { ok: true, data: { xBTC, ZEC } };
}

/** Stored kv value → holdings, falling back to defaults on any malformed content. */
export function offchainFromStored(v: unknown): OffchainHoldings {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const xBTC = Number(o.xBTC);
    const ZEC = Number(o.ZEC);
    if (Number.isFinite(xBTC) && xBTC >= 0 && xBTC <= MAX_HOLDING) {
      if (Number.isFinite(ZEC) && ZEC >= 0 && ZEC <= MAX_HOLDING) return { xBTC, ZEC };
    }
  }
  return { ...DEFAULT_OFFCHAIN };
}
