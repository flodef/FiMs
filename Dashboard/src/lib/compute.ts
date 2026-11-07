import {
  DANGER_RATIO,
  JUP_STAKED,
  LTV_TARGETS,
  MULTIPLY_B17,
  MULTIPLY_C19,
  MULTIPLY_CHANGE_RATE,
  MULTIPLY_G7,
  MULTIPLY_INIT_L9,
} from "./config.js";
import { daysInMonthParis, daysSinceStart } from "./time.js";
import type { ExtraPosition, Inputs, SourceName } from "./types.js";

export type StatusLevel = "ok" | "warn" | "danger" | "error";
export type AlertLevel = "ok" | "warn" | "danger";

export interface CollateralAlert {
  token: string;
  source: string;
  ltv: number;
  target: number | null;
  liqThreshold: number | null;
  level: AlertLevel;
  liqPriceEur: number | null;
  currentPriceEur: number | null;
  /** tracked_positions id for extra positions; undefined for base config rows */
  id?: number;
  /** debt amount to repay to bring LTV back to target, in repayUnit; null when at/below target */
  repayToTarget: number | null;
  repayUnit: string | null;
}

export interface StrategyRowView {
  row: number;
  label: string;
  amount: number | null;
  apy: number | null;
  kind: "row" | "collateral" | "debt" | "fims";
  ltv?: number | null;
  target?: number | null;
  liqThreshold?: number | null;
  liqPriceEur?: number | null;
}

export interface PriceEntry {
  key: string;
  label: string;
  eur: number;
  usd: number | null;
}

export interface BorrowLendRow {
  key: string;
  label: string;
  unit: string;
  gainPct: number;
  value: number;
  gainDay: number;
  valueDay: number;
  valueMonth: number;
}

export interface ExtraComputation extends ExtraPosition {
  valueEur: number;
  perDayEur: number;
  perDay: number;
  perMonth: number;
  noPrice: boolean;
}

export interface DashboardResult {
  cells: Record<string, number>;
  status: StatusLevel;
  stale: boolean;
  staleSources: SourceName[];
  failedSources: SourceName[];
  fetchedAt: number;
  priceUpdatedAt: number | null;
  positionsUpdatedAt: number | null;
  perDay: number;
  perDayText: string;
  perMonth: number;
  perMonthText: string;
  extras: { rows: ExtraComputation[]; perDay: number; perMonth: number };
  borrowLend: {
    rows: BorrowLendRow[];
    totalGainPct: number;
    totalValueDay: number;
    totalValueMonth: number;
  };
  prices: PriceEntry[];
  strategyRows: StrategyRowView[];
  collaterals: CollateralAlert[];
  jupsol: { value: number; ratio: number; apy: number; apySource: "sanctum" | "jupiter" };
  forecasts: { jlpPerDay: number; jupPerDay: number };
  fims: {
    totalSolRatio: number;
    jlpDayAverage: number;
    fimsSolDiff: number;
    fimsEurcDiff: number;
    jlpRatio: number;
    fimsToken: number;
    duePerDay: number;
    total: number;
    gainsPerSol: number;
    eurc: { tokenAmount: number; eurAmount: number };
    usd: { usdAmount: number; eurAmount: number };
  };
  multiply: {
    jlpTotal: number;
    jlpValue: number;
    init: number;
    initValue: number;
    current: number;
    currentValue: number;
    debt: number;
    debtValue: number;
    debitDay: number;
    debitDayValue: number;
    creditDay: number;
    creditDayValue: number;
    totalDay: number;
    totalDayValue: number;
    gains: number;
    gainsValue: number;
    gainsAnnual: number;
    changeDay: number;
  };
}

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const starts = (a: string, prefix: string) => a.toLowerCase().startsWith(prefix.toLowerCase());
const firstWord = (t: string) => t.trim().split(/\s+/)[0] ?? t;
const lastWord = (t: string) => t.trim().split(/\s+/).pop() ?? t;

function sheetMatch(pattern: string, value: string): boolean {
  const re = new RegExp("^" + pattern.split("*").map(escapeRe).join(".*") + "$", "i");
  return re.test(value);
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function computeDashboard(inputs: Inputs, now: Date): DashboardResult {
  const cells: Record<string, number> = {};
  const set = (k: string, v: number | null | undefined) => {
    if (v != null && Number.isFinite(v)) cells[k] = v;
  };

  const positions = inputs.positions ?? [];
  const findPos = (token: string) => positions.find(p => eq(p.token, token));
  const posField = <K extends "amount" | "apy" | "liqThreshold" | "ltv">(token: string, k: K): number | null => {
    const p = findPos(token);
    const v = p?.[k];
    return v != null && Number.isFinite(v) ? v : null;
  };

  // ---- Prices I7:I15 (EUR) ----
  const headers = inputs.defi.priceHeaders ?? [];
  const today = inputs.defi.priceRows?.[0] ?? [];
  const yesterday = inputs.defi.priceRows?.[1] ?? [];
  const day2 = inputs.defi.priceRows?.[2] ?? [];

  const priceIdx = (sym: string): number => {
    const needle = sym.toLowerCase();
    const paren = headers.findIndex(h => h.toLowerCase().includes(`(${needle})`));
    if (paren >= 0) return paren;
    return headers.findIndex(h => h.toLowerCase().includes(needle));
  };
  const px = (sym: string, row: number[]): number => {
    const i = priceIdx(sym);
    return i >= 0 ? num(row[i]) : 0;
  };
  const I: Record<string, number> = {};
  const priceDefs: [string, string, "max1" | "max0"][] = [
    ["I7", "BTC", "max1"],
    ["I8", "SOL", "max1"],
    ["I9", "JUPSOL", "max1"],
    ["I10", "ZEC", "max1"],
    ["I11", "JLP", "max1"],
    ["I12", "JUP", "max0"],
    ["I13", "EUR to USD", "max1"],
  ];
  for (const [cell, sym, mode] of priceDefs) {
    const v = px(sym, today);
    I[cell] = mode === "max0" ? Math.max(0, v) : Math.max(1, v);
    set(cell, I[cell]);
  }
  const fimsIdx = priceIdx("FIMS");
  const fimsRaw = fimsIdx >= 0 ? Math.max(1, 2 * num(yesterday[fimsIdx]) - num(day2[fimsIdx])) : 1;
  I.I14 = fimsRaw;
  set("I14", I.I14);
  I.I15 = 1 / I.I13;
  set("I15", I.I15);

  /** EUR price of a unit/symbol: EUR/EURC→1, USD*→I15, FIMS→I14, else Price-header lookup (same as Prices). */
  const priceEurOf = (unit: string): number | null => {
    const u = unit.trim();
    if (!u) return null;
    if (eq(u, "EUR") || eq(u, "EURC")) return 1;
    const up = u.toUpperCase();
    if (up === "USD" || up.startsWith("USD")) return I.I15;
    if (eq(u, "FIMS")) return I.I14;
    const i = priceIdx(u);
    if (i < 0) return null;
    const v = num(today[i]);
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  // ---- Strategy rows A6:C16 (amount B, apy C) ----
  const targetOf = (token: string) => LTV_TARGETS[token] ?? null;
  const fromPos = (token: string) => ({ amount: posField(token, "amount"), apy: posField(token, "apy") });

  const strat: {
    row: number;
    label: string;
    amount: number | null;
    apy: number | null;
    kind: StrategyRowView["kind"];
    ltv?: number | null;
    target?: number | null;
    liqThreshold?: number | null;
    liqPriceEur?: number | null;
  }[] = [
    { row: 6, label: "Stables", amount: 0, apy: 0, kind: "row" },
    { row: 7, label: "EURC", ...fromPos("EURC"), kind: "row" },
    { row: 8, label: "USDG", ...fromPos("USDG"), kind: "row" },
    {
      row: 9,
      label: "JLP Jupiter",
      amount: posField("JLP", "ltv"),
      apy: targetOf("JLP"),
      kind: "collateral",
      ltv: posField("JLP", "ltv"),
      target: targetOf("JLP"),
      liqThreshold: posField("JLP", "liqThreshold"),
    },
    { row: 10, label: "JLP", ...fromPos("JLP"), kind: "row" },
    { row: 11, label: "USDT JLP", ...fromPos("USDT JLP"), kind: "debt" },
    {
      row: 12,
      label: "JupSOL Jupiter",
      amount: posField("JupSOL", "ltv"),
      apy: targetOf("JupSOL"),
      kind: "collateral",
      ltv: posField("JupSOL", "ltv"),
      target: targetOf("JupSOL"),
      liqThreshold: posField("JupSOL", "liqThreshold"),
    },
    { row: 13, label: "JupSOL", ...fromPos("JupSOL"), kind: "row" },
    { row: 14, label: "USDT JupSOL", ...fromPos("USDT JupSOL"), kind: "debt" },
  ];
  for (const r of strat) {
    set(`B${r.row}`, r.amount);
    set(`C${r.row}`, r.apy);
  }
  const stratAmount = (label: string): number => strat.find(r => eq(r.label, label))?.amount ?? 0;

  // D9/D12 = ltv/target ; D11/D14 = liquidation price
  for (const [cell, ltvRow, debtRow, tokenRow] of [
    ["D9", 9, 11, 10],
    ["D12", 12, 14, 13],
  ] as const) {
    const ltv = strat.find(r => r.row === ltvRow)?.amount ?? null;
    const target = strat.find(r => r.row === ltvRow)?.apy ?? null;
    if (ltv != null && target != null && target !== 0) set(cell, ltv / target);
    const liqT = strat.find(r => r.row === ltvRow)?.liqThreshold ?? null;
    const debtAmt = stratAmount(strat.find(r => r.row === debtRow)!.label);
    const colAmt = stratAmount(strat.find(r => r.row === tokenRow)!.label);
    const liqCell = cell === "D9" ? "D11" : "D14";
    if (liqT != null && liqT > 0 && colAmt > 0) {
      const v = ((debtAmt * (1 / liqT)) / colAmt) * I.I15;
      set(liqCell, v);
      const crow = strat.find(r => r.row === ltvRow)!;
      crow.liqPriceEur = v;
    }
  }

  // ---- Borrow / Lend D2:I5 ----
  const days = daysInMonthParis(now.getTime());
  const lendDefs = [
    { key: "EURC", label: "EURC", row: 2 },
    { key: "USDT", label: "USDT", row: 3 },
    { key: "USDG", label: "USDG", row: 4 },
  ];
  const lendRows: BorrowLendRow[] = [];
  for (const d of lendDefs) {
    const eCands = strat.filter(r => r.row >= 7 && r.row <= 14 && starts(r.label, d.key) && r.apy != null);
    const gainPct = eCands.length ? Math.max(...eCands.map(r => r.apy!)) : 0;
    const fSum = strat
      .filter(r => r.row >= 6 && r.row <= 14 && starts(r.label, d.key))
      .reduce((s, r) => s + (r.amount ?? 0), 0);
    const value = d.key === "EURC" ? Math.min(0, fSum) : fSum;
    const gainDay = (value * gainPct) / 365;
    const valueDay = gainDay * (d.key.startsWith("USD") ? I.I15 : 1);
    const valueMonth = valueDay * days;
    set(`E${d.row}`, gainPct);
    set(`F${d.row}`, value);
    set(`G${d.row}`, gainDay);
    set(`H${d.row}`, valueDay);
    set(`I${d.row}`, valueMonth);
    lendRows.push({ key: d.key, label: d.label, unit: d.key, gainPct, value, gainDay, valueDay, valueMonth });
  }
  const e5 = (lendRows[2].gainPct ?? 0) + (lendRows[1].gainPct ?? 0);
  const h5 = lendRows.reduce((s, r) => s + r.valueDay, 0);
  const i5 = lendRows.reduce((s, r) => s + r.valueMonth, 0);
  set("E5", e5);
  set("H5", h5);
  set("I5", i5);

  // ---- JupSOL M1:M3 ----
  const M2 = num(inputs.sanctum?.jupsolRatio);
  const M3 = num(inputs.sanctum?.jupsolApy);
  const M1 = M2 * I.I8;
  for (const [k, v] of Object.entries({ M1, M2, M3 })) set(k, v);

  // ---- Multiply L8:M9 partial + forecasts M4/M5 + totals B2/B3 ----
  const jlpTotal = num(inputs.defi.jlpTotal);
  const L8 = jlpTotal;
  const M8 = L8 * I.I11;
  set("L8", L8);
  set("M8", M8);
  set("G7", MULTIPLY_G7);

  const maxApyRows = (rowMin: number, rowMax: number, pred: (label: string) => boolean): number => {
    const cands = strat.filter(r => r.row >= rowMin && r.row <= rowMax && pred(r.label) && r.apy != null);
    return cands.length ? Math.max(...cands.map(r => r.apy!)) : 0;
  };
  const M4 =
    Math.round(
      (num(inputs.defi.jlpDayAverage) * L8 - (M8 * maxApyRows(7, 14, l => eq(l, "USD Jupiter"))) / 365) * 100,
    ) / 100;
  const M5 = (JUP_STAKED / 365.25) * 4 * I.I12;
  set("M4", M4);
  set("M5", M5);

  // ---- Extra positions (manual + tracked wallets) — added to totals only, never to sheet rows ----
  const extrasRows: ExtraComputation[] = (inputs.extraPositions ?? []).map(p => {
    const price = priceEurOf(p.unit);
    const perDayEur = price != null ? ((p.amount * p.apy) / 365) * price : 0;
    return {
      ...p,
      valueEur: price != null ? p.amount * price : 0,
      perDayEur,
      perDay: perDayEur,
      perMonth: perDayEur * days,
      noPrice: price == null,
    };
  });
  const extrasPerDay = extrasRows.reduce((s, r) => s + r.perDay, 0);
  const extrasPerMonth = extrasPerDay * days;

  const perDay = Math.round((M4 + M5 + h5 + extrasPerDay) * 100) / 100;
  const perMonth = Math.round((M4 + M5 + h5 + extrasPerDay) * days);
  set("B2", perDay);
  set("B3", perMonth);

  // ---- FiMs block F7:G15 + rows 15/16 ----
  const c15 = strat
    .filter(r => r.row >= 6 && r.row <= 14 && starts(r.label, "EURC"))
    .reduce((s, r) => s + (r.amount ?? 0), 0);
  const B15 = c15 * I.I15;
  const usdG = positions.filter(p => starts(p.token, "USDG")).reduce((s, p) => s + p.amount, 0);
  const usdT = positions.filter(p => starts(p.token, "USDT")).reduce((s, p) => s + p.amount, 0);
  const B16 = usdG - usdT;
  const C16 = B16 * I.I15;
  set("C15", c15);
  set("B15", B15);
  set("B16", B16);
  set("C16", C16);
  strat.push(
    { row: 15, label: "FiMs EURC", amount: B15, apy: c15, kind: "fims" },
    { row: 16, label: "FiMs USD", amount: B16, apy: C16, kind: "fims" },
  );

  const F12 = num(inputs.defi.fimsToken) * I.I14;
  const F10 = stratAmount("EURC") - F12;
  const F9 = stratAmount("JupSOL") - num(inputs.defi.fimsSol);
  const F13 = (F12 * (lendRows[0].gainPct ?? 0)) / 365;
  const F14 = num(inputs.defi.total);
  const F11 = Math.max(0, (stratAmount("USDT JupSOL") - B15 - B16) / ((stratAmount("JupSOL") * I.I11) / I.I15));
  const F7 = F14 / I.I8 / 10000;
  const G15 = (F14 / F7) * MULTIPLY_G7;
  for (const [k, v] of Object.entries({ F7, F8: num(inputs.defi.jlpDayAverage), F9, F10, F11, F12, F13, F14, G15 }))
    set(k, v);

  // ---- Multiply L9:M15 ----
  const changeDay = (MULTIPLY_B17 * MULTIPLY_CHANGE_RATE) / MULTIPLY_C19;
  set("D19", changeDay);
  const L9 = MULTIPLY_INIT_L9;
  const M9 = L9 * changeDay;
  set("L9", L9);
  set("M9", M9);

  const usdJlpSum = strat
    .filter(r => r.row >= 7 && r.row <= 22 && sheetMatch("USD* JLP*", r.label))
    .reduce((s, r) => s + (r.amount ?? 0), 0);
  const M11 = Math.min(0, (usdJlpSum - B16) * I.I15);
  const L11 = M11 / I.I11;
  const L10 = L8 - L11;
  const M10 = L10 * I.I11;
  const M12 = -(maxApyRows(7, 14, l => sheetMatch("USD* Jupiter", l)) * M11) / 365;
  const L12 = M12 / I.I11;
  const M13 = (M10 - M9) / daysSinceStart(now.getTime());
  const L13 = M13 / I.I11;
  const M14 = M13 + M12;
  const L14 = M14 / I.I11;
  const L15 = L10 - L9;
  const M15 = (M14 / M9) * 365;
  for (const [k, v] of Object.entries({ L10, M10, L11, M11, L12, M12, L13, M13, L14, M14, L15, M15 })) set(k, v);

  // ---- Collaterals + status ----
  const extraInputs = inputs.extraPositions ?? [];
  // Extra collaterals have no sheet liq-price cell: derive it from the entry's own
  // debt rows — sum(debt amount × priceEur) / (liqThreshold × collateral amount).
  const extraLiqPriceEur = (col: ExtraPosition): number | null => {
    const lt = col.liqThreshold;
    if (lt == null || !Number.isFinite(lt) || !(col.amount > 0)) return null;
    const colTok = col.token.trim().toLowerCase();
    let debtEur = 0;
    let matched = false;
    for (const d of extraInputs) {
      if (d.id !== col.id) continue;
      const words = d.token.trim().split(/\s+/);
      if (words.length < 2 || words[words.length - 1].toLowerCase() !== colTok) continue;
      const pr = priceEurOf(words[0]);
      if (pr == null) return null;
      debtEur += d.amount * pr;
      matched = true;
    }
    return matched ? debtEur / (lt * col.amount) : null;
  };
  const collaterals: CollateralAlert[] = [];
  for (const p of [...positions, ...extraInputs]) {
    if (p.ltv == null || !Number.isFinite(p.ltv)) continue;
    const t = LTV_TARGETS[p.token];
    const target = t != null && t > 0 ? t : null;
    const liqT = p.liqThreshold != null && Number.isFinite(p.liqThreshold) ? p.liqThreshold : null;
    const danger = liqT != null && p.ltv >= DANGER_RATIO * liqT;
    const level: AlertLevel = danger ? "danger" : target != null && p.ltv > target ? "warn" : "ok";
    const crow = strat.find(r => eq(r.label, p.token) || eq(r.label, `${p.token} Jupiter`));
    const sym = p.token.trim().split(/\s+/).pop() ?? p.token;
    const eid = (p as ExtraPosition).id;

    // Repay-to-target: debtAmount × (1 − target/ltv) in debt-token units.
    let repayToTarget: number | null = null;
    let repayUnit: string | null = null;
    if (target != null && p.ltv > target) {
      const colTok = p.token.trim().toLowerCase();
      if (eid != null) {
        let amt = 0;
        let unit: string | null = null;
        for (const d of extraInputs) {
          if (d.id !== eid) continue;
          const words = d.token.trim().split(/\s+/);
          if (words.length < 2 || words[words.length - 1].toLowerCase() !== colTok) continue;
          amt += d.amount;
          unit ??= words[0];
        }
        if (amt > 0 && unit != null) {
          repayToTarget = amt * (1 - target / p.ltv);
          repayUnit = unit;
        }
      } else {
        const debts = strat.filter(r => r.kind === "debt" && lastWord(r.label).toLowerCase() === colTok);
        const amt = debts.reduce((s, r) => s + (r.amount ?? 0), 0);
        if (debts.length > 0 && amt > 0) {
          repayToTarget = amt * (1 - target / p.ltv);
          repayUnit = firstWord(debts[0].label);
        }
      }
    }

    collaterals.push({
      token: p.token,
      source: p.source,
      ltv: p.ltv,
      target,
      liqThreshold: liqT,
      level,
      liqPriceEur: eid != null ? extraLiqPriceEur(p as ExtraPosition) : (crow?.liqPriceEur ?? null),
      currentPriceEur: priceEurOf(sym),
      id: eid,
      repayToTarget,
      repayUnit,
    });
  }

  const srcNames: SourceName[] = ["jupiter", "kamino", "sanctum", "defi"];
  const failedSources = srcNames.filter(s => !inputs.sources?.[s]?.ok);
  const staleSources = srcNames.filter(s => inputs.sources?.[s]?.stale);
  const anyDanger = collaterals.some(c => c.level === "danger");
  const anyWarn = collaterals.some(c => c.level === "warn");
  const status: StatusLevel = failedSources.length ? "error" : anyDanger ? "danger" : anyWarn ? "warn" : "ok";

  const posTimes = [inputs.sources?.jupiter?.at, inputs.sources?.kamino?.at].filter(
    (t): t is number => typeof t === "number",
  );
  const positionsUpdatedAt = posTimes.length ? Math.max(...posTimes) : inputs.fetchedAt;

  // ---- Views ----
  const priceEntries: PriceEntry[] = [
    { key: "I7", label: "BTC", eur: I.I7, usd: I.I7 * I.I13 },
    { key: "I8", label: "SOL", eur: I.I8, usd: I.I8 * I.I13 },
    { key: "I9", label: "JUPSOL", eur: I.I9, usd: I.I9 * I.I13 },
    { key: "I10", label: "ZEC", eur: I.I10, usd: I.I10 * I.I13 },
    { key: "I11", label: "JLP", eur: I.I11, usd: I.I11 * I.I13 },
    { key: "I12", label: "JUP", eur: I.I12, usd: I.I12 * I.I13 },
    { key: "I13", label: "EUR to USD", eur: I.I13, usd: null },
    { key: "I14", label: "FIMS", eur: I.I14, usd: I.I14 * I.I13 },
    { key: "I15", label: "USD", eur: I.I15, usd: null },
  ];

  const strategyRows: StrategyRowView[] = strat.map(r => ({
    row: r.row,
    label: r.label,
    amount: r.amount,
    apy: r.apy,
    kind: r.kind,
    ltv: r.ltv ?? null,
    target: r.target ?? null,
    liqThreshold: r.ltv != null ? (r.liqThreshold ?? null) : null,
    liqPriceEur: r.liqPriceEur ?? null,
  }));

  return {
    cells,
    status,
    stale: staleSources.length > 0,
    staleSources,
    failedSources,
    fetchedAt: inputs.fetchedAt,
    priceUpdatedAt: Number.isFinite(inputs.defi.priceLastUpdated) ? inputs.defi.priceLastUpdated : null,
    positionsUpdatedAt,
    perDay,
    perDayText: `${perDay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € / day`,
    perMonth,
    perMonthText: `${perMonth.toLocaleString("en-US", { maximumFractionDigits: 0 })} € / month`,
    extras: { rows: extrasRows, perDay: extrasPerDay, perMonth: extrasPerMonth },
    borrowLend: {
      rows: lendRows,
      totalGainPct: e5,
      totalValueDay: h5,
      totalValueMonth: i5,
    },
    prices: priceEntries,
    strategyRows,
    collaterals,
    jupsol: {
      value: M1,
      ratio: M2,
      apy: inputs.sanctum?.jupsolApy ?? 0,
      apySource: inputs.sanctum?.jupsolApySource ?? "sanctum",
    },
    forecasts: { jlpPerDay: M4, jupPerDay: M5 },
    fims: {
      totalSolRatio: F7,
      jlpDayAverage: num(inputs.defi.jlpDayAverage),
      fimsSolDiff: F9,
      fimsEurcDiff: F10,
      jlpRatio: F11,
      fimsToken: F12,
      duePerDay: F13,
      total: F14,
      gainsPerSol: G15,
      eurc: { tokenAmount: c15, eurAmount: B15 },
      usd: { usdAmount: B16, eurAmount: C16 },
    },
    multiply: {
      jlpTotal: L8,
      jlpValue: M8,
      init: L9,
      initValue: M9,
      current: L10,
      currentValue: M10,
      debt: L11,
      debtValue: M11,
      debitDay: L12,
      debitDayValue: M12,
      creditDay: L13,
      creditDayValue: M13,
      totalDay: L14,
      totalDayValue: M14,
      gains: L15,
      gainsValue: L15 * I.I11,
      gainsAnnual: M15,
      changeDay,
    },
  };
}
