import { FETCH_TIMEOUT_MS } from "./config";
import { computeDashboard } from "./compute";
import type { DashboardResult } from "./compute";
import { fetchDefi } from "./sources/defi";
import { fetchJupiter } from "./sources/jupiter";
import { fetchKamino } from "./sources/kamino";
import { fetchSanctum, type SanctumRaw } from "./sources/sanctum";
import { getLastGood, setLastGood } from "./storage";
import type { DefiData, Inputs, PositionRow, SanctumData, SourceName, SourceStatus } from "./types";

/** _copyValues rule: a row is kept only if token non-empty and amount/apy are valid numbers. */
export function sanitizeRows(rows: PositionRow[]): PositionRow[] {
  return rows.filter(
    r =>
      typeof r?.token === "string" &&
      r.token.trim() !== "" &&
      Number.isFinite(r.amount) &&
      Number.isFinite(r.apy) &&
      (r.liqThreshold === undefined || Number.isFinite(r.liqThreshold)) &&
      (r.ltv === undefined || Number.isFinite(r.ltv)),
  );
}

const validRows = (rows: PositionRow[]) => rows.length >= 1;
const validSanctum = (s: SanctumRaw) => Number.isFinite(s.jupsolRatio) && Number.isFinite(s.jupsolApy);
const validDefi = (d: DefiData) =>
  [d.jlpTotal, d.fimsSol, d.fimsToken, d.total, d.jlpDayAverage, d.priceLastUpdated].every(Number.isFinite) &&
  d.priceRows.length >= 3 &&
  d.priceHeaders.length > 0;

async function timed<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), FETCH_TIMEOUT_MS + 2000)),
  ]);
}

interface SourceOutcome<T> {
  data: T | null;
  ok: boolean;
  stale: boolean;
  at: number;
  error?: string;
}

async function withLastGood<T>(
  source: SourceName,
  fetcher: () => Promise<T>,
  validate: (d: T) => boolean,
): Promise<SourceOutcome<T>> {
  const now = Date.now();
  try {
    const data = await timed(fetcher());
    if (!validate(data)) throw new Error("validation failed");
    await setLastGood(source, data);
    return { data, ok: true, stale: false, at: now };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const lg = await getLastGood<T>(source);
    if (lg) return { data: lg.data, ok: true, stale: true, at: lg.at, error: err };
    return { data: null, ok: false, stale: false, at: now, error: err };
  }
}

export async function fetchInputs(): Promise<Inputs> {
  const env = (k: string) => process.env[k] ?? "";

  const [jup, kam, san, def] = await Promise.all([
    withLastGood<PositionRow[]>("jupiter", () => fetchJupiter(env("JUPITER_API_KEY")).then(sanitizeRows), validRows),
    withLastGood<PositionRow[]>("kamino", () => fetchKamino().then(sanitizeRows), validRows),
    withLastGood<SanctumRaw>("sanctum", () => fetchSanctum(), validSanctum),
    withLastGood<DefiData>("defi", () => fetchDefi(env("GOOGLE_API_KEY")), validDefi),
  ]);

  const jupRows = sanitizeRows(jup.data ?? []);
  const kamRows = sanitizeRows(kam.data ?? []);
  const positions = [...jupRows, ...kamRows];

  let sanctum: SanctumData;
  if (san.data) {
    const apy = san.data.jupsolApy;
    const fallback = positions.find(p => p.token === "JupSOL")?.apy ?? 0;
    const useFallback = !(apy > 0);
    sanctum = {
      jupsolRatio: san.data.jupsolRatio,
      jupsolApy: useFallback ? fallback : apy,
      jupsolApySource: useFallback ? "jupiter" : "sanctum",
    };
  } else {
    sanctum = { jupsolRatio: 0, jupsolApy: 0, jupsolApySource: "sanctum" };
  }

  const defi: DefiData = def.data ?? {
    priceHeaders: [],
    priceRows: [[], [], []],
    jlpDayAverage: 0,
    jlpTotal: 0,
    fimsSol: 0,
    fimsToken: 0,
    total: 0,
    priceLastUpdated: 0,
  };

  const mk = (o: SourceOutcome<unknown>): SourceStatus => ({ ok: o.ok, stale: o.stale, at: o.at, error: o.error });
  const sources: Record<SourceName, SourceStatus> = {
    jupiter: mk(jup),
    kamino: mk(kam),
    sanctum: mk(san),
    defi: mk(def),
  };

  return { fetchedAt: Date.now(), positions, sanctum, defi, sources };
}

export async function computeLive(): Promise<{ inputs: Inputs; result: DashboardResult }> {
  const inputs = await fetchInputs();
  return { inputs, result: computeDashboard(inputs, new Date()) };
}
