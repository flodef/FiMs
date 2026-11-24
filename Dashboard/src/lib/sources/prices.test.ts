import { describe, expect, test } from "bun:test";
import { livePriceRow } from "./prices.js";

// mirrors Price!B1:R1 headers ↔ Tokens!A symbols
const HEADERS = [
  "Date",
  "EUR to USD (EURC)",
  "FiMs SOL (FSOL)",
  "FiMs Token (FiMs)",
  "FiMs Liquidity Provider (FLiP)",
  "Zcash (ZEC)",
  "OKX Wrapped BTC (xBTC)",
  "Ether (ETH)",
  "Solana (SOL)",
  "Jupiter (JUP)",
  "Jupiter Staked SOL (JUPSOL)",
  "Jupiter Perps LP (JLP)",
  "Drift Staked SOL (DSOL)",
  "Paypal USD (PYUSD)",
  "USDS (USDS)",
  "USD Tether (USDT)",
  "USD Circle (USDC)",
  "Euro Circle (EURC)",
];
const TOKENS = [
  { symbol: "FSOL", mint: "m-fsol" },
  { symbol: "FiMs", mint: "m-fims" },
  { symbol: "FLiP", mint: "m-flip" },
  { symbol: "ZEC", mint: "m-zec" },
  { symbol: "xBTC", mint: "m-xbtc" },
  { symbol: "ETH", mint: "m-eth" },
  { symbol: "SOL", mint: "m-sol" },
  { symbol: "JUP", mint: "m-jup" },
  { symbol: "JUPSOL", mint: "m-jupsol" },
  { symbol: "JLP", mint: "m-jlp" },
  { symbol: "DSOL", mint: "m-dsol" },
  { symbol: "PYUSD", mint: "m-pyusd" },
  { symbol: "USDS", mint: "m-usds" },
  { symbol: "USDT", mint: "m-usdt" },
  { symbol: "USDC", mint: "m-usdc" },
  { symbol: "EURC", mint: "m-eurc" },
];
const SHEET = [0, 1.09, 80, 1.2, 3.3, 700, 50000, 1500, 60, 0.2, 80, 3.3, 80, 0.91, 0.91, 0.91, 0.91, 1];

describe("livePriceRow", () => {
  test("derivations: EURC rate, FSOL/FLiP aliases, stables, others, FiMs untouched", () => {
    const usd: Record<string, number> = {
      "m-eurc": 1.095251, // → round5 = 1.09525
      "m-jupsol": 86.0,
      "m-jlp": 3.6334,
      "m-jup": 0.2305,
      "m-sol": 70.0,
      "m-zec": 730.0,
      "m-xbtc": 55000.0,
      "m-eth": 1600.0,
      // m-dsol intentionally unpriced → not all live
      // stables + derived (FSOL/FLiP/FiMs) mints unpriced — must not matter
    };
    const r = livePriceRow(HEADERS, SHEET, TOKENS, usd)!;
    expect(r).not.toBeNull();
    expect(r.eurUsd).toBe(1.09525);
    const at = (name: string) => r.row[HEADERS.findIndex(h => h === name)];
    expect(at("EUR to USD (EURC)")).toBe(1.09525);
    expect(at("FiMs SOL (FSOL)")).toBeCloseTo(86.0 / 1.09525, 8); // = JUPSOL eur
    expect(at("Jupiter Staked SOL (JUPSOL)")).toBeCloseTo(86.0 / 1.09525, 8);
    expect(at("FiMs Liquidity Provider (FLiP)")).toBeCloseTo(3.6334 / 1.09525, 8); // = JLP eur
    expect(at("Jupiter Perps LP (JLP)")).toBeCloseTo(3.6334 / 1.09525, 8);
    expect(at("FiMs Token (FiMs)")).toBe(1.2); // untouched — compute.ts derives it
    expect(at("Paypal USD (PYUSD)")).toBeCloseTo(1 / 1.09525, 8);
    expect(at("USD Tether (USDT)")).toBeCloseTo(1 / 1.09525, 8);
    expect(at("Euro Circle (EURC)")).toBe(1);
    expect(at("Jupiter (JUP)")).toBeCloseTo(Math.round(0.2305 * 1e5) / 1e5 / 1.09525, 8);
    expect(at("Solana (SOL)")).toBeCloseTo(70.0 / 1.09525, 8);
    expect(r.jupsolEur).toBeCloseTo(86.0 / 1.09525, 8);
    expect(r.jlpEur).toBeCloseTo(3.6334 / 1.09525, 8);
    expect(r.allLive).toBe(false); // m-dsol unpriced → not all live
  });

  test("missing mint keeps the sheet value; EURC missing → null", () => {
    const usd: Record<string, number> = { "m-eurc": 1.09 };
    const r = livePriceRow(HEADERS, SHEET, TOKENS, usd)!;
    expect(r.eurUsd).toBe(1.09);
    expect(r.row[HEADERS.indexOf("Solana (SOL)")]).toBe(SHEET[HEADERS.indexOf("Solana (SOL)")]); // kept
    expect(r.row[HEADERS.indexOf("Jupiter (JUP)")]).toBe(SHEET[HEADERS.indexOf("Jupiter (JUP)")]); // kept
    expect(r.row[HEADERS.indexOf("USD Tether (USDT)")]).toBeCloseTo(1 / 1.09, 8); // stable still derived
    expect(livePriceRow(HEADERS, SHEET, TOKENS, {})).toBeNull();
  });

  test("allLive true when every non-stable/non-FiMs mint is priced", () => {
    const usd: Record<string, number> = {};
    for (const t of TOKENS) {
      if (!["PYUSD", "USDS", "USDT", "USDC", "FiMs"].includes(t.symbol)) usd[t.mint] = 1.5;
    }
    usd["m-eurc"] = 1.09;
    const r = livePriceRow(HEADERS, SHEET, TOKENS, usd)!;
    expect(r.allLive).toBe(true);
  });
});
