import { FETCH_TIMEOUT_MS } from "./config.js";
import { computeDashboard } from "./compute.js";
import type { DashboardResult } from "./compute.js";
import { fetchDefi } from "./sources/defi.js";
import { fetchJupiter } from "./sources/jupiter.js";
import { fetchKamino } from "./sources/kamino.js";
import { fetchSanctum, type SanctumRaw } from "./sources/sanctum.js";
import { getLastGood, setLastGood, trackedList } from "./storage.js";
import type {
  DefiData,
  ExtraPosition,
  Inputs,
  PositionRow,
  SanctumData,
  SourceName,
  SourceStatus,
  TrackedPosition,
} from "./types.js";

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
  source: SourceName | string,
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

const firstWord = (s: string) => s.trim().split(/\s+/)[0] ?? "";
const rowsOk = (rows: PositionRow[]) => Array.isArray(rows);

async function fetchTrackedEntry(t: TrackedPosition, jupKey: string): Promise<PositionRow[]> {
  if (t.kind === "jupiter") return sanitizeRows(await fetchJupiter(jupKey, t.wallet ?? ""));
  if (t.kind === "kamino") {
    const symbols = (t.tokens ?? "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    return sanitizeRows(await fetchKamino(t.wallet ?? "", symbols));
  }
  return [];
}

/** Extra positions from tracked_positions — isolated per entry, never affect main sources. */
async function fetchExtras(tracked: TrackedPosition[]): Promise<ExtraPosition[]> {
  const jupKey = process.env.JUPITER_API_KEY ?? "";
  const groups = await Promise.all(
    tracked.map(async (t): Promise<ExtraPosition[]> => {
      const meta = {
        id: t.id,
        origin: t.kind,
        label: t.label ?? undefined,
        platform: t.platform ?? undefined,
        wallet: t.wallet ?? undefined,
        tokens: t.tokens ?? undefined,
      };
      if (t.kind === "manual") {
        const amount = t.amount != null && Number.isFinite(t.amount) ? Math.max(0, t.amount) : 0;
        const apy = t.apy != null && Number.isFinite(t.apy) ? t.apy : 0;
        const unit = (t.unit ?? "").trim().toUpperCase();
        return [
          {
            ...meta,
            token: t.asset ?? t.label ?? "Manual",
            source: "Manual",
            amount,
            apy,
            unit,
          },
        ];
      }
      const outcome = await withLastGood<PositionRow[]>(`tracked:${t.id}`, () => fetchTrackedEntry(t, jupKey), rowsOk);
      const rows = outcome.data ?? [];
      if (!rows.length) {
        // placeholder so empty tracked wallets stay visible/removable in the UI
        return [
          {
            ...meta,
            token: "(empty)",
            source: t.kind === "jupiter" ? "Jupiter Earn" : "Kamino Borrow",
            amount: 0,
            apy: 0,
            unit: "",
            stale: outcome.stale || undefined,
            error: outcome.ok ? undefined : outcome.error,
          },
        ];
      }
      return rows.map(r => ({
        ...r,
        ...meta,
        unit: firstWord(r.token),
        stale: outcome.stale || undefined,
        error: outcome.ok ? undefined : outcome.error,
      }));
    }),
  );
  return groups.flat();
}

export async function fetchInputs(): Promise<Inputs> {
  const env = (k: string) => process.env[k] ?? "";

  const tracked = await trackedList();

  const [jup, kam, san, def, extras] = await Promise.all([
    withLastGood<PositionRow[]>("jupiter", () => fetchJupiter(env("JUPITER_API_KEY")).then(sanitizeRows), validRows),
    withLastGood<PositionRow[]>("kamino", () => fetchKamino().then(sanitizeRows), validRows),
    withLastGood<SanctumRaw>("sanctum", () => fetchSanctum(), validSanctum),
    withLastGood<DefiData>("defi", () => fetchDefi(env("GOOGLE_API_KEY")), validDefi),
    fetchExtras(tracked),
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

  return { fetchedAt: Date.now(), positions, sanctum, defi, sources, extraPositions: extras };
}

export async function computeLive(): Promise<{ inputs: Inputs; result: DashboardResult }> {
  const inputs = await fetchInputs();
  return { inputs, result: computeDashboard(inputs, new Date()) };
}
