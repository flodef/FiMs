export type RebalanceKey = "JLP" | "JupSOL";

export interface PlanPositionInput {
  key: RebalanceKey;
  vaultId: number;
  positionId: number;
  /** supply value in USD */
  collateralUsd: number;
  /** borrow amount in debt-token units (USDT) */
  debt: number;
  /** debt token price in USD */
  debtPriceUsd: number;
  target: number;
}

export interface PositionDelta {
  key: RebalanceKey;
  vaultId: number;
  positionId: number;
  ltvBefore: number;
  /** expected LTV after the plan executes — exactly target when acted on */
  ltvAfter: number;
  /** USDT to repay (>0) or borrow (>0); exactly one is non-zero */
  repayUsdt: number;
  borrowUsdt: number;
  /** current borrow in USDT units (repay cap) */
  debt: number;
  target: number;
}

export interface LendOp {
  key: RebalanceKey;
  vaultId: number;
  positionId: number;
  /** signed USDT delta: positive = borrow, negative = repay */
  deltaUsdt: number;
}

export type StagePurpose = "rebalance" | "topup";

export type PlanStage =
  | { type: "lend"; ops: LendOp[]; purpose?: StagePurpose }
  | {
      type: "kamino-withdraw";
      /** estimated USDG to withdraw (build refines via ExactOut quote) */
      amountUsdg: number;
      /** USDT the withdraw must cover — sizes the ExactOut quote at build time */
      usdtOut: number;
      /** absent = rebalance */
      purpose?: StagePurpose;
    }
  | {
      type: "swap";
      pair: "usdg-usdt" | "usdt-usdg";
      mode: "ExactIn";
      amount: number;
      /** display only — live-quote estimates of the swap input/output */
      estIn?: number;
      estOut?: number;
      /** absent = rebalance */
      purpose?: StagePurpose;
    }
  | {
      type: "kamino-deposit";
      amountUsdg: number;
      /** display only — quoted USDG from the swap */
      estUsdg?: number;
      purpose?: StagePurpose;
    }
  | {
      type: "spend-transfer";
      /** USDT to send to the Jupiter Spend address */
      usdt: number;
      purpose?: StagePurpose;
    };

export interface RebalancePlan {
  positions: PositionDelta[];
  stages: PlanStage[];
  kaminoUsdg: number;
  /** set when the plan cannot proceed (e.g. insufficient Kamino balance) */
  error: string | null;
}

const MIN_DELTA_USDT = 1;

function positionDelta(p: PlanPositionInput): PositionDelta {
  const ltv = p.collateralUsd > 0 && p.debtPriceUsd > 0 ? (p.debt * p.debtPriceUsd) / p.collateralUsd : 0;
  let repayUsdt = 0;
  let borrowUsdt = 0;
  if (p.collateralUsd > 0 && p.debtPriceUsd > 0) {
    if (ltv > p.target) {
      repayUsdt = p.debt * (1 - p.target / ltv);
    } else {
      borrowUsdt = (p.collateralUsd * p.target) / p.debtPriceUsd - p.debt;
    }
  }
  const acted = repayUsdt >= MIN_DELTA_USDT || borrowUsdt >= MIN_DELTA_USDT;
  if (!acted) {
    repayUsdt = 0;
    borrowUsdt = 0;
  }
  return {
    key: p.key,
    vaultId: p.vaultId,
    positionId: p.positionId,
    ltvBefore: ltv,
    ltvAfter: acted ? p.target : ltv,
    repayUsdt,
    borrowUsdt,
    debt: p.debt,
    target: p.target,
  };
}

export interface RepayRawShare {
  /** |client-sent delta| in raw USDT units (1e-6 USDT) — proportional weight */
  plannedRaw: number;
  /** min(debt, freshRepay×1.001) in raw units — hard cap per position */
  capRaw: number;
}

/**
 * Distribute available raw USDT across repay ops proportionally to planned
 * amounts, in exact integer units: floor each share, give the remainder to the
 * largest op, never exceed a cap. Sum equals `availableRaw` whenever the caps
 * allow it — the caller detects "wallet-limited" by comparing the sum.
 */
export function distributeRepayRaw(availableRaw: number, ops: RepayRawShare[]): number[] {
  const avail = Math.floor(availableRaw);
  const totalPlanned = ops.reduce((s, o) => s + o.plannedRaw, 0);
  if (!Number.isFinite(avail) || avail <= 0 || totalPlanned <= 0) return ops.map(() => 0);
  const raws = ops.map(o =>
    Math.max(0, Math.min(o.capRaw, Number((BigInt(avail) * BigInt(o.plannedRaw)) / BigInt(totalPlanned)))),
  );
  const rem = avail - raws.reduce((a, b) => a + b, 0);
  if (rem > 0) {
    // remainder → the largest op that still has headroom under its cap
    let li = -1;
    raws.forEach((r, i) => {
      if (r < ops[i].capRaw && (li < 0 || r > raws[li])) li = i;
    });
    if (li >= 0) raws[li] = Math.min(ops[li].capRaw, raws[li] + rem);
  }
  return raws;
}

const lendOp = (d: PositionDelta, deltaUsdt: number): LendOp => ({
  key: d.key,
  vaultId: d.vaultId,
  positionId: d.positionId,
  deltaUsdt,
});

export function buildPlan(positions: PlanPositionInput[], kaminoUsdg: number): RebalancePlan {
  const deltas = positions.map(positionDelta);
  const acting = deltas.filter(d => d.repayUsdt > 0 || d.borrowUsdt > 0);
  const repays = acting.filter(d => d.repayUsdt > 0);
  const borrows = acting.filter(d => d.borrowUsdt > 0);

  const plan: RebalancePlan = { positions: deltas, stages: [], kaminoUsdg, error: null };
  if (acting.length === 0) return plan;

  const kaminoShort = (need: number) => {
    if (kaminoUsdg + 1e-9 < need) {
      plan.error = `Insufficient Kamino USDG: need ~${need.toFixed(2)}, have ${kaminoUsdg.toFixed(2)}`;
    }
  };

  if (repays.length > 0 && borrows.length === 0) {
    // Both deficit: withdraw USDG (sized by an ExactOut quote at build) → swap ALL of it ExactIn → repay both
    const total = repays.reduce((s, d) => s + d.repayUsdt, 0);
    kaminoShort(total);
    plan.stages = [
      { type: "kamino-withdraw", amountUsdg: total, usdtOut: total },
      { type: "swap", pair: "usdg-usdt", mode: "ExactIn", amount: total },
      { type: "lend", ops: repays.map(d => lendOp(d, -d.repayUsdt)) },
    ];
    return plan;
  }

  if (borrows.length > 0 && repays.length === 0) {
    // Both margin: borrow both → swap ExactIn USDT→USDG → deposit to Kamino
    const total = borrows.reduce((s, d) => s + d.borrowUsdt, 0);
    plan.stages = [
      { type: "lend", ops: borrows.map(d => lendOp(d, d.borrowUsdt)) },
      { type: "swap", pair: "usdt-usdg", mode: "ExactIn", amount: total },
      { type: "kamino-deposit", amountUsdg: total },
    ];
    return plan;
  }

  // Mixed: one deficit D, one margin M (the only multi-position case in practice)
  const d = repays[0];
  const m = borrows[0];
  const D = d.repayUsdt;
  const M = m.borrowUsdt;
  const covered = Math.min(D, M);
  const firstLend: LendOp[] = [lendOp(m, M), lendOp(d, -covered)];

  if (D > M) {
    const rest = D - M;
    kaminoShort(rest);
    plan.stages = [
      { type: "lend", ops: firstLend },
      { type: "kamino-withdraw", amountUsdg: rest, usdtOut: rest },
      { type: "swap", pair: "usdg-usdt", mode: "ExactIn", amount: rest },
      { type: "lend", ops: [lendOp(d, -rest)] },
    ];
  } else if (M > D) {
    const rest = M - D;
    plan.stages = [
      { type: "lend", ops: firstLend },
      { type: "swap", pair: "usdt-usdg", mode: "ExactIn", amount: rest },
      { type: "kamino-deposit", amountUsdg: rest },
    ];
  } else {
    plan.stages = [{ type: "lend", ops: firstLend }];
  }
  return plan;
}

// ---------- top up card (Jupiter Spend) ----------

export const TOPUP_MAX_USDT = 10_000;

/**
 * Pure top-up plan: withdraw USDG from Kamino → swap all to USDT → send to the
 * Jupiter Spend address. USDG≈USDT≈USD so the requested USDT amount sizes all stages.
 */
export function buildTopupPlan(usdt: number, kaminoUsdg: number): RebalancePlan {
  const plan: RebalancePlan = { positions: [], stages: [], kaminoUsdg, error: null };
  if (!Number.isFinite(usdt) || usdt < 1 || usdt > TOPUP_MAX_USDT) {
    plan.error = `Amount must be between 1 and ${TOPUP_MAX_USDT.toLocaleString("en-US")} USDT`;
    return plan;
  }
  if (kaminoUsdg + 1e-9 < usdt) {
    plan.error = `Insufficient Kamino USDG: need ~${usdt.toFixed(2)}, have ${kaminoUsdg.toFixed(2)}`;
    return plan;
  }
  plan.stages = [
    { type: "kamino-withdraw", amountUsdg: usdt, usdtOut: usdt, purpose: "topup" },
    { type: "swap", pair: "usdg-usdt", mode: "ExactIn", amount: usdt, purpose: "topup" },
    { type: "spend-transfer", usdt, purpose: "topup" },
  ];
  return plan;
}

/**
 * Fixed priority fee = 1 lamport per tx (total 0.000005001 SOL with the base fee) —
 * the user's known-good setting. Priority fee = ceil(microLamports × cuLimit / 1e6)
 * → µL/CU = floor(1e6 / cuLimit), min 1, so the charged priority is 1 lamport.
 */
export function priorityMicroLamports(cuLimit: number): number {
  if (!Number.isFinite(cuLimit) || cuLimit <= 0) return 1;
  return Math.max(1, Math.floor(1e6 / cuLimit));
}
