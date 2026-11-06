import { FETCH_TIMEOUT_MS, KAMINO_MARKET, WALLET } from "../config.js";
import type { PositionRow } from "../types.js";

async function kget(path: string): Promise<any> {
  const res = await fetch(`https://api.kamino.finance/kamino-market/${KAMINO_MARKET}${path}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`kamino ${path} → HTTP ${res.status}`);
  return res.json();
}

async function exchangeRate(reserveAddress: string): Promise<number> {
  try {
    const data = await kget(`/reserves/${reserveAddress}/metrics/history`);
    const history = data?.history ?? [];
    const last = history[history.length - 1];
    const rate = last?.metrics ? Number(last.metrics.exchangeRate) : NaN;
    return rate > 0 ? rate : 1;
  } catch {
    return 1;
  }
}

/** Port of KaminoPosition(wallet, "USDG") — returns the USDG deposit row. */
export async function fetchKamino(): Promise<PositionRow[]> {
  const [obligationsData, reservesRaw] = await Promise.all([
    kget(`/users/${WALLET}/obligations`),
    kget(`/reserves/metrics`),
  ]);
  const reserves: any[] = reservesRaw ?? [];

  const reserveByAddr: Record<string, any> = {};
  for (const r of reserves ?? []) reserveByAddr[r.reserve] = r;

  const userDeposits: { reserve: string; amountRaw: number }[] = [];
  const list = Array.isArray(obligationsData) ? obligationsData : [];
  for (const obl of list) {
    for (const d of obl?.state?.deposits ?? []) {
      const raw = Number(d.depositedAmount || 0);
      if (raw > 0 && d.depositReserve && !d.depositReserve.startsWith("11111111")) {
        userDeposits.push({ reserve: d.depositReserve, amountRaw: raw });
      }
    }
  }

  const sym = (r: any) => (r?.liquidityToken || "").toUpperCase();
  const candidates: any[] = reserves
    .filter((r: any) => sym(r) === "USDG")
    .sort((a: any, b: any) => Number(b.totalSupplyUsd || 0) - Number(a.totalSupplyUsd || 0));

  let reserve: any = null;
  let amountRaw = 0;
  for (const ud of userDeposits) {
    const r = reserveByAddr[ud.reserve];
    if (r && sym(r) === "USDG") {
      reserve = r;
      amountRaw = ud.amountRaw;
      break;
    }
  }
  if (!reserve) reserve = candidates[0] || null;
  if (!reserve) throw new Error("USDG reserve not found");
  if (!amountRaw) {
    const ud = userDeposits.find(x => {
      const r = reserveByAddr[x.reserve];
      return r && sym(r) === "USDG";
    });
    if (ud) amountRaw = ud.amountRaw;
  }

  const apy = Number(reserve.supplyApy || 0);
  const rate = await exchangeRate(reserve.reserve);
  const amount = amountRaw / 1e6 / rate;
  return [{ source: "Kamino Borrow", token: "USDG", amount, apy }];
}
