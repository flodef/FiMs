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

export interface Inputs {
  fetchedAt: number; // ms
  positions: PositionRow[];
  sanctum: SanctumData;
  defi: DefiData;
  sources: Record<SourceName, SourceStatus>;
}
