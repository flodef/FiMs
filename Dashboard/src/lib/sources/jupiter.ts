import { FETCH_TIMEOUT_MS, WALLET } from "../config.js";
import type { PositionRow } from "../types.js";

const API = "https://api.jup.ag/lend/v1";

async function jget(path: string, apiKey: string): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    headers: { "x-api-key": apiKey },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`jupiter ${path} → HTTP ${res.status}`);
  return res.json();
}

/** APR (rate/10000) → compounded APY fraction, port of Code.js JupiterPortfolioTable. */
const aprToApy = (rate: unknown): number => {
  const apr = (Number(rate) || 0) / 10000;
  return apr > 0 ? Math.pow(1 + apr / 365, 365) - 1 : 0;
};

const src = (token: string): PositionRow["source"] => (token === "EURC" ? "Jupiter Earn" : "Jupiter Borrow");

export async function fetchJupiter(apiKey: string): Promise<PositionRow[]> {
  if (!apiKey) throw new Error("JUPITER_API_KEY missing");
  const rows: PositionRow[] = [];

  const earnRates: Record<string, number> = {};
  try {
    const tokens = await jget("/earn/tokens", apiKey);
    for (const t of tokens ?? []) {
      const addr = t.assetAddress || t.address;
      if (addr) earnRates[addr] = aprToApy(t.totalRate);
    }
  } catch {
    // Code.js swallows this; positions fall back to token.totalRate
  }

  const earn = await jget(`/earn/positions?users=${WALLET}`, apiKey);
  for (const pos of earn ?? []) {
    const token = pos.token || {};
    const addr = token.assetAddress || token.address;
    const symbol = token.asset?.symbol || token.symbol || "?";
    const decimals = token.decimals || 6;
    const amount = Number(pos.underlyingAssets || 0) / 10 ** decimals;
    if (amount <= 0.01) continue;
    const apy = earnRates[addr] || aprToApy(token.totalRate);
    rows.push({ source: src(symbol), token: symbol, amount, apy });
  }

  const borrow = await jget(`/borrow/positions?users=${WALLET}`, apiKey);
  for (const pos of borrow ?? []) {
    const vault = pos.vault || {};
    const supplyToken = vault.supplyToken || {};
    const borrowToken = vault.borrowToken || {};
    const supplyAmount = Number(pos.supply || 0) / 10 ** (supplyToken.decimals || 9);
    const borrowAmount = Number(pos.borrow || 0) / 10 ** (borrowToken.decimals || 6);
    if (supplyAmount <= 0.01 && borrowAmount <= 0.01) continue;
    const supplySymbol = supplyToken.symbol || "?";
    const borrowSymbol = borrowToken.symbol || "?";
    const supplyUsd = supplyAmount * (Number(supplyToken.price) || 0);
    const borrowUsd = borrowAmount * (Number(borrowToken.price) || 1);
    const ltv = supplyUsd > 0 ? borrowUsd / supplyUsd : 0;
    const liqThreshold = (Number(vault.liquidationThreshold) || 0) / 1000;
    const supplyApy = aprToApy(supplyToken.stakingApr);
    const borrowApy = aprToApy(vault.borrowRate);
    if (supplyAmount > 0.01) {
      rows.push({
        source: src(supplySymbol),
        token: supplySymbol,
        amount: supplyAmount,
        apy: supplyApy,
        liqThreshold,
        ltv,
      });
    }
    if (borrowAmount > 0.01) {
      rows.push({
        source: "Jupiter Borrow",
        token: `${borrowSymbol} ${supplySymbol}`,
        amount: borrowAmount,
        apy: -borrowApy,
      });
    }
  }
  return rows;
}
