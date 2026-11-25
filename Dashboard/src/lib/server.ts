import { CIRCULATION_URL, DEFI_TIMEOUT_MS, FETCH_TIMEOUT_MS, JUP_STAKE_PROGRAM, TOKENS, WALLET2 } from "./config.js";
import { computeDashboard } from "./compute.js";
import type { DashboardResult } from "./compute.js";
import { fetchCirculation } from "./sources/circulation.js";
import { fetchDefi } from "./sources/defi.js";
import { fetchJupiter } from "./sources/jupiter.js";
import { fetchKamino } from "./sources/kamino.js";
import { fetchJupiterPrices, livePriceRow } from "./sources/prices.js";
import { fetchSanctum, type SanctumRaw } from "./sources/sanctum.js";
import { getLastGood, offchainGet, setLastGood, trackedList } from "./storage.js";
import { WALLET } from "./config.js";
import { RESTORE_TOKENS } from "./rebalance/plan.js";
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

/**
 * Freshness window for cached sources: a last-good entry younger than this is
 * served without refetching, so bursts (multi-user polls, cron overlap,
 * visibility-change refreshes) collapse into one upstream fetch cycle. Live
 * Jupiter prices are fetched outside this cache and stay fresh every call.
 */
const SOURCE_TTL_MS = 6 * 60_000;

async function timed<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs + 2000))]);
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
  timeoutMs = FETCH_TIMEOUT_MS,
  ttlMs = 0,
): Promise<SourceOutcome<T>> {
  const now = Date.now();
  if (ttlMs > 0) {
    const lg = await getLastGood<T>(source);
    if (lg && now - lg.at < ttlMs) return { data: lg.data, ok: true, stale: false, at: lg.at };
  }
  try {
    const data = await timed(fetcher(), timeoutMs);
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
      const outcome = await withLastGood<PositionRow[]>(
        `tracked:${t.id}`,
        () => fetchTrackedEntry(t, jupKey),
        rowsOk,
        FETCH_TIMEOUT_MS,
        SOURCE_TTL_MS,
      );
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

interface ChainData {
  walletBalances?: Record<string, number>;
  stakedJup?: number;
  walletTokens?: { jupsol: number; jlp: number; eurc: number; usdg: number };
}

const CHAIN_RPC_TIMEOUT_MS = 5000;
const chainTimeout = <T>(p: Promise<T>) =>
  Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("chain rpc timeout")), CHAIN_RPC_TIMEOUT_MS)),
  ]);

/**
 * All Helius-derived inputs in one pass: loose wallet balances (both wallets),
 * staked JUP, and the restore-relevant wallet token amounts — the latter are
 * read off the same token-account sweep instead of four extra per-mint calls.
 * @solana/web3.js is imported lazily so cache-hit invocations never pay its
 * module-init cost at cold start.
 */
async function fetchChain(): Promise<ChainData> {
  const key = process.env.HELIUS_API_KEY ?? "";
  if (!key) return {};
  const [{ Connection, PublicKey }, { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID }] = await Promise.all([
    import("@solana/web3.js"),
    import("@solana/spl-token"),
  ]);
  const connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${key}`, "confirmed");
  const SOL_MINT = "So11111111111111111111111111111111111111112";

  const balancesP = (async () => {
    const perWallet = await Promise.all(
      [WALLET, WALLET2].map(async w => {
        const owner = new PublicKey(w);
        const acc: Record<string, number> = {};
        const add = (mint: string, amt: number) => {
          if (Number.isFinite(amt)) acc[mint] = (acc[mint] ?? 0) + amt;
        };
        add(SOL_MINT, (await connection.getBalance(owner)) / 1e9);
        for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
          const res = await connection.getParsedTokenAccountsByOwner(owner, { programId });
          for (const { account } of res.value) {
            const info = (account.data as any)?.parsed?.info;
            const amt = info?.tokenAmount?.uiAmount;
            if (typeof info?.mint === "string" && Number.isFinite(amt)) add(info.mint, Number(amt));
          }
        }
        return acc;
      }),
    );
    const walletBalances: Record<string, number> = {};
    for (const acc of perWallet) {
      for (const [mint, amt] of Object.entries(acc)) walletBalances[mint] = (walletBalances[mint] ?? 0) + amt;
    }
    const w0 = perWallet[0] ?? {};
    const pick = (k: keyof typeof RESTORE_TOKENS) => w0[RESTORE_TOKENS[k].mint] ?? 0;
    return {
      walletBalances,
      walletTokens: { jupsol: pick("jupsol"), jlp: pick("jlp"), eurc: pick("eurc"), usdg: pick("usdg") },
    };
  })();

  // getStakedJup equivalent: stake-program accounts owned by each wallet,
  // staked amount = u64 LE at byte offset 105 (accounts < 113 bytes skipped)
  const stakeP = (async () => {
    const program = new PublicKey(JUP_STAKE_PROGRAM);
    let lamports = 0n;
    for (const w of [WALLET, WALLET2]) {
      const res = await connection.getProgramAccounts(program, {
        encoding: "base64",
        filters: [{ memcmp: { offset: 40, bytes: w } }],
      });
      for (const { account } of res) {
        // RPC returns data as [payload, encoding] tuple or a raw buffer
        const raw: unknown = account.data;
        const payload = Array.isArray(raw) ? raw[0] : raw;
        const buf =
          typeof payload === "string"
            ? Buffer.from(payload, "base64")
            : payload instanceof Uint8Array
              ? Buffer.from(payload)
              : null;
        if (!buf || buf.length < 113) continue;
        lamports += buf.readBigUInt64LE(105);
      }
    }
    return Number(lamports) / 1e6;
  })();

  const [balances, stakedJup] = await Promise.all([
    chainTimeout(balancesP).catch(() => null),
    chainTimeout(stakeP).catch(() => null),
  ]);
  return {
    walletBalances: balances?.walletBalances,
    walletTokens: balances?.walletTokens,
    stakedJup: stakedJup ?? undefined,
  };
}

const chainDataOk = (d: ChainData) => d != null && typeof d === "object";

export async function fetchInputs(): Promise<Inputs> {
  const env = (k: string) => process.env[k] ?? "";

  const [tracked, offchain] = await Promise.all([trackedList(), offchainGet()]);

  const [jup, kam, san, def, extras, circ, chain] = await Promise.all([
    withLastGood<PositionRow[]>(
      "jupiter",
      () => fetchJupiter(env("JUPITER_API_KEY")).then(sanitizeRows),
      validRows,
      FETCH_TIMEOUT_MS,
      SOURCE_TTL_MS,
    ),
    withLastGood<PositionRow[]>(
      "kamino",
      () => fetchKamino().then(sanitizeRows),
      validRows,
      FETCH_TIMEOUT_MS,
      SOURCE_TTL_MS,
    ),
    withLastGood<SanctumRaw>("sanctum", () => fetchSanctum(), validSanctum, FETCH_TIMEOUT_MS, SOURCE_TTL_MS),
    withLastGood<DefiData>("defi", () => fetchDefi(env("GOOGLE_API_KEY")), validDefi, DEFI_TIMEOUT_MS, SOURCE_TTL_MS),
    fetchExtras(tracked),
    // member token counts from the Wallet-V3 ledger — best-effort, no source
    // flag and no last-good: the sheet FiMsData values stay the fallback.
    // CIRCULATION_URL env override exists for local runs before deploy.
    fetchCirculation(env("CIRCULATION_URL") || CIRCULATION_URL).catch(() => null),
    withLastGood<ChainData>("chain", fetchChain, chainDataOk, FETCH_TIMEOUT_MS, SOURCE_TTL_MS),
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

  // ---- live Jupiter prices → override a copy of today's Price row (best-effort) ----
  // mint map comes from the static TOKENS table (Tokens!A2:C), not the sheet fetch
  let defiOut: DefiData = defi;
  if (defi.priceHeaders.length > 1 && defi.priceRows.length > 0) {
    try {
      const usd = await fetchJupiterPrices(
        env("JUPITER_API_KEY"),
        TOKENS.map(t => t.mint),
      );
      const sheetRow = defi.priceRows[0] ?? [];
      const live = livePriceRow(defi.priceHeaders, sheetRow, TOKENS, usd);
      if (live) {
        defiOut = {
          ...defi,
          priceRows: [live.row, ...defi.priceRows.slice(1)],
          sheetEurUsd: defi.eurUsd,
          priceSource: live.allLive ? "jupiter" : "sheet",
          priceLastUpdated: live.allLive ? Date.now() : defi.priceLastUpdated,
          eurUsd: live.eurUsd,
          walletPrices:
            live.jupsolEur != null && live.jlpEur != null
              ? { jupsol: live.jupsolEur, eurc: live.eurUsd, jlp: live.jlpEur }
              : defi.walletPrices,
        };
      }
    } catch {
      /* price API hiccup — sheet prices stay */
    }
  }

  // ---- chain-derived inputs (wallet balances, staked JUP, wallet tokens) ----
  // served from the shared "chain" cache when fresh; failures stay best-effort
  // and never flag a source (absent fields → treated as 0 / sheet fallback)
  const chainData = chain.data;
  if (chainData?.walletBalances) defiOut = { ...defiOut, walletBalances: chainData.walletBalances };
  const stakedJup = chainData?.stakedJup;
  const walletTokens = chainData?.walletTokens;

  // ---- member token counts: Wallet-V3 ledger over sheet FiMsData!B1:B3 ----
  if (circ) {
    defiOut = {
      ...defiOut,
      fimsSol: circ.FSOL.total,
      fimsToken: circ.FiMs.total,
      fimsLp: circ.FLiP.total,
      fimsSource: "ledger",
    };
  } else {
    defiOut = { ...defiOut, fimsSource: "sheet" };
  }

  return {
    fetchedAt: Date.now(),
    positions,
    sanctum,
    defi: defiOut,
    sources,
    extraPositions: extras,
    walletTokens,
    stakedJup,
    offchain,
  };
}

export async function computeLive(): Promise<{ inputs: Inputs; result: DashboardResult }> {
  const inputs = await fetchInputs();
  return { inputs, result: computeDashboard(inputs, new Date()) };
}
