export type Unit = "EUR" | "USD" | "FIMS" | "FSOL" | "FLiP" | "SOL" | "BTC" | "JUP" | "ZEC";

export const UNITS: Unit[] = ["EUR", "USD", "FIMS", "FSOL", "FLiP", "SOL", "BTC", "JUP", "ZEC"];

export interface PriceMap {
  EUR: number;
  USD: number; // I15, EUR per USD
  FIMS: number; // I14
  FSOL: number; // I9
  FLiP: number; // I11
  SOL: number; // I8
  BTC: number; // I7
  JUP: number; // I12
  ZEC: number; // I10
  eurToUsd: number; // I13, USD per EUR
}

const roundDown = (v: number, decimals: number) => {
  const f = 10 ** decimals;
  return (v < 0 ? Math.ceil(v * f - 1e-9) : Math.floor(v * f + 1e-9)) / f;
};

// decimals mirror the sheet converter: EUR/USD/FIMS 2, FSOL/FLiP 3; bonus units scaled to price magnitude
const DECIMALS: Record<Unit, number> = { EUR: 2, USD: 2, FIMS: 2, FSOL: 3, FLiP: 3, SOL: 4, BTC: 8, JUP: 2, ZEC: 6 };

/** Port of Strategy!F17:K22 — every pair routes through EUR with no intermediate rounding. */
export function convert(amount: number, unit: Unit, p: PriceMap): Record<Unit, number> {
  const eurValue = amount * p[unit];
  const out = {} as Record<Unit, number>;
  for (const target of UNITS) {
    if (target === unit) {
      out[target] = amount;
      continue;
    }
    if (target === "EUR") out[target] = roundDown(eurValue, DECIMALS.EUR);
    else if (target === "USD") out[target] = roundDown(eurValue * p.eurToUsd, DECIMALS.USD);
    else out[target] = roundDown(eurValue / p[target], DECIMALS[target]);
  }
  return out;
}

export function priceMapFromCells(cells: Record<string, number>): PriceMap {
  const I = (k: string) => cells[k] ?? 0;
  return {
    EUR: 1,
    USD: I("I15"),
    FIMS: I("I14"),
    FSOL: I("I9"),
    FLiP: I("I11"),
    SOL: I("I8"),
    BTC: I("I7"),
    JUP: I("I12"),
    ZEC: I("I10"),
    eurToUsd: I("I13"),
  };
}
