export type SourceName = "jupiter" | "kamino" | "sanctum" | "defi";

export interface PositionRow {
  source: "Jupiter Earn" | "Jupiter Borrow" | "Kamino Borrow" | string;
  token: string;
  amount: number;
  apy: number; // fraction, debt negative
  liqThreshold?: number; // fraction
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
}
