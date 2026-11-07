import { DEFI_SHEET_ID, DEFI_TIMEOUT_MS, SHEETS_REFERER } from "../config.js";
import { serialToParisMs } from "../time.js";
import type { DefiData } from "../types.js";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function fetchDefiOnce(apiKey: string): Promise<DefiData> {
  const ranges = ["Price!A1:R", "Wallet!D5", "FiMsData!B1", "FiMsData!B2", "Dashboard!B12", "PriceCache!C2:C"];
  const qs = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join("&");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${DEFI_SHEET_ID}/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&key=${apiKey}`;
  const res = await fetch(url, { headers: { Referer: SHEETS_REFERER }, signal: AbortSignal.timeout(DEFI_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`sheets → HTTP ${res.status}`);
  const body: any = await res.json();
  const vr = body?.valueRanges ?? [];

  const priceValues: unknown[][] = vr[0]?.values ?? [];
  const priceHeaders = (priceValues[0] ?? []).map(h => String(h ?? ""));
  const dataRows: unknown[][] = priceValues.slice(1);

  const fipsIdx = priceHeaders.findIndex(h => /liquidity provider/i.test(h));
  let sum = 0;
  let n = 0;
  if (fipsIdx >= 0) {
    for (let i = 0; i < dataRows.length - 1; i++) {
      const nxt = dataRows[i + 1]?.[fipsIdx];
      if (typeof nxt === "number" && nxt !== 0) {
        const cur = dataRows[i]?.[fipsIdx];
        sum += (typeof cur === "number" ? cur : 0) - nxt;
        n++;
      }
    }
  }
  const jlpDayAverage = n > 0 ? sum / n : 0;

  const cell = (rangeIdx: number): number => num(vr[rangeIdx]?.values?.[0]?.[0]);
  const toRow = (r: unknown[]): number[] => (r ?? []).map(v => num(v));
  const priceRows = dataRows.slice(0, 3).map(toRow);

  const cacheSerials = ((vr[5]?.values ?? []) as unknown[][]).map(r => num(r?.[0])).filter(v => v > 0);
  const priceLastUpdated = cacheSerials.length ? serialToParisMs(Math.min(...cacheSerials)) : 0;

  return {
    priceHeaders,
    priceRows,
    jlpDayAverage,
    jlpTotal: cell(1),
    fimsSol: cell(2),
    fimsToken: cell(3),
    total: cell(4),
    priceLastUpdated,
  };
}

/** Port of the FiMs DeFi sheet pull: Price history (reduced), Wallet, FiMsData, Dashboard, PriceCache.
 *  The Price!A1:R range is ~530 KB and can take several seconds — retries once on timeout/5xx. */
export async function fetchDefi(apiKey: string): Promise<DefiData> {
  if (!apiKey) throw new Error("GOOGLE_API_KEY missing");
  const started = Date.now();
  try {
    return await fetchDefiOnce(apiKey);
  } catch (e) {
    const retryable = /timeout|abort|HTTP 5\d\d/i.test(String(e));
    if (retryable && Date.now() - started < 10000) return fetchDefiOnce(apiKey);
    throw e;
  }
}
