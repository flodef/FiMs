export type SourceName = "jupiter" | "kamino" | "sanctum" | "defi";

export interface PositionRow {
  source: "Jupiter Earn" | "Jupiter Borrow" | "Kamino Borrow" | string;
  token: string;
  amount: number;
  apy: number; // fraction, debt negative
  liqThreshold?: number; // fraction
  /** collateral factor — Jupiter's hard on-chain LTV ceiling */
  maxLtv?: number; // fraction
  ltv?: number; // fraction
}

export interface SourceStatus {
  ok: boolean;
  stale: boolean;
  at: number;
  error?: string;
}

export interface DefiData {
  priceHeaders: string[];
  priceRows: number[][]; // today, yesterday, day-2; col0 = date serial
  jlpDayAverage: number;
  jlpTotal: number; // Wallet!D5
  fimsSol: number; // FiMsData!B1
  fimsToken: number; // FiMsData!B2
  total: number; // Dashboard!B12
  priceLastUpdated: number; // ms epoch
  /** FiMsData!B14:B17 — IMPORTRANGE'd Strategy values the Wallet total is built from */
  imported?: { fimsUsd: number; jupsol: number; fimsEurc: number; jlp: number };
  /** Wallet!C3:C5 — prices used by the sheet's own total */
  walletPrices?: { jupsol: number; eurc: number; jlp: number };
  /** PriceCache!B2 — sheet's EUR→USD rate */
  eurUsd?: number;
  /** FiMsData!B3 — FLiP token count (1:1 JLP-priced) */
  fimsLp?: number;
  /** Tokens!A2:C — symbol → mint map for live Jupiter prices */
  tokens?: { symbol: string; name: string; mint: string }[];
  /** Wallet!A2:K — the sheet's total rows (absent when any amount is non-numeric) */
  walletRows?: { underlying: string; token: string; mint: string; amount: number; cache: number }[];
  /** "jupiter" when api.jup.ag prices overrode the sheet ones, else "sheet"/absent */
  priceSource?: "jupiter" | "sheet";
  /** "ledger" when Wallet-V3 /fims/circulation supplied fimsSol/fimsToken/fimsLp, else "sheet" */
  fimsSource?: "sheet" | "ledger";
  /** sheet EUR→USD (PriceCache!B2) preserved before live overrides */
  sheetEurUsd?: number;
  /** sheet today price row (Price!B:R values) preserved before live overrides */
  sheetPriceRow?: number[];
  /** live on-chain balances per mint across both tracked wallets */
  walletBalances?: Record<string, number>;
}

export interface SanctumData {
  jupsolRatio: number;
  jupsolApy: number;
  jupsolApySource: "sanctum" | "jupiter";
}

export type TrackedKind = "manual" | "jupiter" | "kamino";

/** Row in tracked_positions — the user-managed config. */
export interface TrackedPosition {
  id: number;
  kind: TrackedKind;
  label: string | null;
  platform: string | null;
  wallet: string | null;
  tokens: string | null;
  asset: string | null;
  amount: number | null;
  apy: number | null;
  unit: string | null;
}

/** A position shown + counted in totals but never fed into the sheet formulas. */
export interface ExtraPosition extends PositionRow {
  id: number;
  origin: TrackedKind;
  unit: string;
  label?: string;
  platform?: string;
  wallet?: string;
  tokens?: string;
  stale?: boolean;
  error?: string;
}

export interface Inputs {
  fetchedAt: number; // ms
  positions: PositionRow[];
  sanctum: SanctumData;
  defi: DefiData;
  sources: Record<SourceName, SourceStatus>;
  extraPositions?: ExtraPosition[];
  /** loose token balances in the main wallet (absent when the fetch failed) */
  walletTokens?: { jupsol: number; jlp: number; eurc: number; usdg: number };
  /** staked JUP across both wallets (Jupiter stake program); absent on RPC failure */
  stakedJup?: number;
  /** off-chain holdings counted in the live Total (kv `offchain_holdings`, defaults when unset) */
  offchain?: { xBTC: number; ZEC: number };
}
