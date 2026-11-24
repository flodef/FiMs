const PRICE_URL = "https://api.jup.ag/price/v3";
const PRICE_TIMEOUT_MS = 5000;
const MAX_IDS = 50;

/** USD-stable symbols priced as 1/eurUsd (no Jupiter lookup needed) */
const USD_STABLES = new Set(["PYUSD", "USDS", "USDT", "USDC"]);

const round5 = (x: number) => Math.round(x * 1e5) / 1e5;
const symOf = (header: string) => header.match(/\(([^)]+)\)\s*$/)?.[1] ?? "";

/**
 * Live USD prices from api.jup.ag/price/v3 — one batched call per ≤50 mints.
 * Returns {mint: usdPrice} for priced mints only (usdPrice > 0); mints the API
 * doesn't cover are simply absent. Throws on HTTP/parse failure.
 */
export async function fetchJupiterPrices(apiKey: string, mints: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(mints.map(m => m.trim()).filter(Boolean))];
  const out: Record<string, number> = {};
  for (let i = 0; i < unique.length; i += MAX_IDS) {
    const chunk = unique.slice(i, i + MAX_IDS);
    const headers: Record<string, string> = {};
    if (apiKey) headers["x-api-key"] = apiKey;
    const res = await fetch(`${PRICE_URL}?ids=${chunk.map(encodeURIComponent).join(",")}`, {
      headers,
      signal: AbortSignal.timeout(PRICE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`jupiter price → HTTP ${res.status}`);
    const body = (await res.json()) as Record<string, { usdPrice?: unknown }>;
    for (const mint of chunk) {
      const p = Number(body?.[mint]?.usdPrice);
      if (Number.isFinite(p) && p > 0) out[mint] = p;
    }
  }
  return out;
}

export interface LivePriceResult {
  /** today's price row with live values where available (sheet value kept otherwise) */
  row: number[];
  /** live EUR→USD rate (= round5 of the EURC mint's usdPrice) */
  eurUsd: number;
  jupsolEur: number | null;
  jlpEur: number | null;
  /** true when EURC + every non-stable/non-FiMs mint came back priced */
  allLive: boolean;
}

/**
 * Derive the sheet's EUR price columns from live Jupiter USD prices — same
 * rules as the DeFi sheet's PriceCache!D formulas:
 *   "EUR to USD (EURC)" → round5(usd[EURC]); FSOL → JUPSOL price; FLiP → JLP price;
 *   FiMs → untouched (compute.ts derives it); USD stables → 1/eurUsd; "Euro Circle" → 1;
 *   everything else → round5(usd[mint])/eurUsd. Returns null when EURC is unpriced.
 */
export function livePriceRow(
  headers: string[],
  sheetRow: number[],
  tokens: { symbol: string; mint: string }[],
  usd: Record<string, number>,
): LivePriceResult | null {
  const tok = (sym: string) => tokens.find(t => t.symbol.toLowerCase() === sym.toLowerCase());
  const eurcUsd = usd[tok("EURC")?.mint ?? ""];
  if (!(eurcUsd > 0)) return null;
  const eurUsd = round5(eurcUsd);
  const eur = (mint: string | undefined): number | null => {
    const u = mint ? usd[mint] : undefined;
    return u != null && u > 0 ? round5(u) / eurUsd : null;
  };

  const jupsolMint = tok("JUPSOL")?.mint;
  const jlpMint = tok("JLP")?.mint;
  const jupsolEur = eur(jupsolMint);
  const jlpEur = eur(jlpMint);

  const row = [...sheetRow];
  for (let j = 1; j < headers.length; j++) {
    const h = headers[j];
    const sym = symOf(h).toUpperCase();
    let v: number | null;
    if (/eur to usd/i.test(h)) v = eurUsd;
    else if (sym === "FSOL") v = jupsolEur;
    else if (sym === "FLIP") v = jlpEur;
    else if (sym === "FIMS")
      v = null; // derived live in compute.ts
    else if (USD_STABLES.has(sym)) v = 1 / eurUsd;
    else if (sym === "EURC") v = 1;
    else v = eur(tok(symOf(h))?.mint);
    if (v != null && Number.isFinite(v) && v > 0) row[j] = v;
  }

  // FSOL/FLiP columns derive from JUPSOL/JLP and FiMs is derived in compute.ts —
  // their own (unpriced) protocol mints don't count toward allLive.
  const DERIVED = new Set(["FSOL", "FLIP", "FIMS"]);
  const needed = tokens.filter(t => !USD_STABLES.has(t.symbol.toUpperCase()) && !DERIVED.has(t.symbol.toUpperCase()));
  const allLive = needed.every(t => (usd[t.mint] ?? 0) > 0);
  return { row, eurUsd, jupsolEur, jlpEur, allLive };
}
