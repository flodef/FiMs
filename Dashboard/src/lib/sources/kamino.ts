import { FETCH_TIMEOUT_MS, KAMINO_MARKET, WALLET } from "../config.js";
import type { PositionRow } from "../types.js";

async function kget(path: string): Promise<any> {
  const res = await fetch(`https://api.kamino.finance/kamino-market/${KAMINO_MARKET}${path}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`kamino ${path} → HTTP ${res.status}`);
  return res.json();
}

async function exchangeRate(reserveAddress: string, cache: Map<string, number>): Promise<number> {
  const hit = cache.get(reserveAddress);
  if (hit != null) return hit;
  let rate = 1;
  try {
    const data = await kget(`/reserves/${reserveAddress}/metrics/history`);
    const history = data?.history ?? [];
    const last = history[history.length - 1];
    const r = last?.metrics ? Number(last.metrics.exchangeRate) : NaN;
    if (r > 0) rate = r;
  } catch {
    // keep 1
  }
  cache.set(reserveAddress, rate);
  return rate;
}

/** Port of KaminoPosition(wallet, tokens) — one deposit row per requested symbol. */
export async function fetchKamino(wallet: string = WALLET, symbols: string[] = ["USDG"]): Promise<PositionRow[]> {
  const wanted = symbols.map(s => s.trim().toUpperCase()).filter(Boolean);
  const [obligationsData, reservesRaw] = await Promise.all([
    kget(`/users/${wallet}/obligations`),
    kget(`/reserves/metrics`),
  ]);
  const reserves: any[] = reservesRaw ?? [];

  const reserveByAddr: Record<string, any> = {};
  for (const r of reserves ?? []) reserveByAddr[r.reserve] = r;

  const sym = (r: any) => (r?.liquidityToken || "").toUpperCase();
  const wantedSet = new Set(wanted);

  const userDeposits: { reserve: string; amountRaw: number; symbol: string }[] = [];
  const list = Array.isArray(obligationsData) ? obligationsData : [];
  for (const obl of list) {
    for (const d of obl?.state?.deposits ?? []) {
      const raw = Number(d.depositedAmount || 0);
      if (raw <= 0 || !d.depositReserve || d.depositReserve.startsWith("11111111")) continue;
      const r = reserveByAddr[d.depositReserve];
      const s = r ? sym(r) : "";
      if (wantedSet.has(s)) userDeposits.push({ reserve: d.depositReserve, amountRaw: raw, symbol: s });
    }
  }

  const rateCache = new Map<string, number>();
  const rows: PositionRow[] = [];
  for (const symbol of wanted) {
    const candidates: any[] = reserves
      .filter((r: any) => sym(r) === symbol)
      .sort((a: any, b: any) => Number(b.totalSupplyUsd || 0) - Number(a.totalSupplyUsd || 0));

    let reserve: any = null;
    let amountRaw = 0;
    const best = userDeposits.filter(d => d.symbol === symbol).sort((a, b) => b.amountRaw - a.amountRaw)[0];
    if (best) {
      reserve = reserveByAddr[best.reserve] ?? null;
      amountRaw = best.amountRaw;
    }
    if (!reserve) reserve = candidates[0] || null;
    if (!reserve) continue;

    const apy = Number(reserve.supplyApy || 0);
    const rate = await exchangeRate(reserve.reserve, rateCache);
    const amount = amountRaw / 1e6 / rate;
    rows.push({ source: "Kamino Borrow", token: symbol, amount, apy });
  }
  return rows;
}
