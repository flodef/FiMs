import { DANGER_RATIO } from "../config.js";

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

export type StagePurpose = "rebalance" | "topup" | "restore";

// ---------- restore (FiMs Diff → target token) ----------

export type RestoreTarget = "jupsol" | "eurc" | "usd" | "jlp";
export type RestoreSource = "kamino" | "lend";

export const RESTORE_TITLE: Record<RestoreTarget, string> = { jupsol: "JupSOL", eurc: "EURC", usd: "USD", jlp: "JLP" };

/** Token registry for restore swaps — mint + decimals per unit. */
export const RESTORE_TOKENS = {
  usdg: { mint: "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH", decimals: 6, symbol: "USDG" },
  jlp: { mint: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", decimals: 6, symbol: "JLP" },
  jupsol: { mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", decimals: 9, symbol: "JupSOL" },
  eurc: { mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", decimals: 6, symbol: "EURC" },
  usdt: { mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6, symbol: "USDT" },
} as const;
export type RestoreToken = keyof typeof RESTORE_TOKENS;

/** Hard cap: USD value of the restore source per run. */
export const RESTORE_MAX_USD = 20_000;

export type PlanStage =
  | { type: "lend"; ops: LendOp[]; purpose?: StagePurpose }
  | {
      type: "kamino-withdraw";
      /** estimated USDG to withdraw (build refines via ExactOut quote) */
      amountUsdg: number;
      /** USDT the withdraw must cover — sizes the ExactOut quote at build time */
      usdtOut: number;
      /** exact USDG to withdraw — restore plans (sized directly, no usdtOut quote) */
      usdgOut?: number;
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
      type: "swap-any";
      inToken: RestoreToken;
      outToken: RestoreToken;
      /** ExactIn amount in INPUT token units */
      amount: number;
      estIn?: number;
      estOut?: number;
      /** slippage bps chosen at plan time — kept on the stage so Resume reuses it */
      slippageBps?: number;
      purpose?: StagePurpose;
    }
  | {
      type: "earn-withdraw";
      token: "EURC";
      /** EURC units to withdraw from Jupiter Earn */
      amount: number;
      purpose?: "restore";
    }
  | {
      type: "lend-collateral";
      key: RebalanceKey;
      vaultId: number;
      positionId: number;
      /** signed collateral units: >0 deposit, <0 withdraw (Jupiter Lend operate) */
      amount: number;
      purpose?: StagePurpose;
    }
  | {
      type: "earn-deposit";
      token: "EURC";
      /** EURC units to deposit into Jupiter Earn */
      amount: number;
      purpose?: "restore";
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
 * Pure top-up plan from Lend JLP: withdraw JLP collateral → swap to USDT →
 * send to the Jupiter Spend address. Same LTV guard as restore withdraws.
 */
export function buildTopupPlanLend(opts: {
  usdt: number;
  /** sized JLP collateral to withdraw */
  jlpAmount: number;
  jlp?: RestoreVaultInput;
  kaminoUsdg: number;
  /** quoted USDT the swap yields (display only) */
  estOut?: number;
  slippageBps?: number;
}): RebalancePlan {
  const { usdt, jlpAmount, jlp, kaminoUsdg } = opts;
  const plan: RebalancePlan = { positions: [], stages: [], kaminoUsdg, error: null };
  if (!Number.isFinite(usdt) || usdt < 1 || usdt > TOPUP_MAX_USDT) {
    plan.error = `Amount must be between 1 and ${TOPUP_MAX_USDT.toLocaleString("en-US")} USDT`;
    return plan;
  }
  if (!Number.isFinite(jlpAmount) || jlpAmount <= 0) {
    plan.error = "Could not size the JLP amount";
    return plan;
  }
  if (!jlp) {
    plan.error = "No JLP lend position found";
    return plan;
  }
  const afterUsd = jlp.collateralUsd - jlpAmount * jlp.supplyPriceUsd;
  const ltvAfter = ltvOf(jlp, afterUsd);
  if (!(afterUsd > 0) || ltvAfter >= ltvCeiling(jlp)) {
    plan.error = `Withdrawing ${jlpAmount.toFixed(2)} JLP would push JLP LTV to ${(ltvAfter * 100).toFixed(1)}% — too close to liquidation`;
    return plan;
  }
  if (jlpAmount > jlp.supplyAmount) {
    plan.error = `Withdrawing ${jlpAmount.toFixed(2)} JLP exceeds the ${jlp.supplyAmount.toFixed(2)} held in the vault`;
    return plan;
  }
  plan.positions.push(vaultDelta(jlp, afterUsd));
  plan.stages = [
    {
      type: "lend-collateral",
      key: "JLP",
      vaultId: jlp.vaultId,
      positionId: jlp.positionId,
      amount: -jlpAmount,
      purpose: "topup",
    },
    {
      type: "swap-any",
      inToken: "jlp",
      outToken: "usdt",
      amount: jlpAmount,
      estIn: jlpAmount,
      estOut: opts.estOut,
      slippageBps: opts.slippageBps,
      purpose: "topup",
    },
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

// ---------- restore plan ----------

export interface RestoreVaultInput {
  key: RebalanceKey;
  vaultId: number;
  positionId: number;
  /** current supply value in USD */
  collateralUsd: number;
  /** borrow in USDT units */
  debt: number;
  debtPriceUsd: number;
  /** collateral units held in the position */
  supplyAmount: number;
  supplyPriceUsd: number;
  /** vault liquidation threshold, fraction */
  liqThreshold: number;
  /** vault collateral factor, fraction — hard on-chain ceiling for operate */
  collateralFactor?: number;
  /** LTV target, fraction */
  target: number;
}

export type RestoreDirection = "buy" | "sell";

export const RESTORE_COMBOS: Record<RestoreTarget, RestoreSource[]> = {
  jupsol: ["kamino", "lend"],
  eurc: ["kamino", "lend"],
  usd: ["lend"],
  jlp: ["kamino"],
};

/** Sell combos: counter-asset for the swap output — kamino = USDG, lend = JLP. */
export const RESTORE_SELL_COMBOS: Record<RestoreTarget, RestoreSource[]> = {
  jupsol: ["kamino", "lend"],
  eurc: ["kamino", "lend"],
  usd: ["lend"],
  jlp: ["kamino"],
};

const ltvOf = (v: RestoreVaultInput, collateralUsd: number) =>
  collateralUsd > 0 && v.debtPriceUsd > 0 ? (v.debt * v.debtPriceUsd) / collateralUsd : 0;

/** Post-op LTV ceiling: the vault's collateral factor (Jupiter's hard on-chain
 *  limit, operate rejects above it) minus an oracle-drift margin; falls back to
 *  the spec danger rule when the vault doesn't expose a collateral factor. */
const ltvCeiling = (v: RestoreVaultInput): number => {
  if (v.collateralFactor != null && v.collateralFactor > 0) return v.collateralFactor * 0.995;
  return v.liqThreshold > 0 ? DANGER_RATIO * v.liqThreshold : Infinity;
};

const vaultDelta = (v: RestoreVaultInput, collateralUsdAfter: number): PositionDelta => ({
  key: v.key,
  vaultId: v.vaultId,
  positionId: v.positionId,
  ltvBefore: ltvOf(v, v.collateralUsd),
  ltvAfter: ltvOf(v, collateralUsdAfter),
  repayUsdt: 0,
  borrowUsdt: 0,
  debt: v.debt,
  target: v.target,
});

/**
 * Push a lend-collateral WITHDRAW stage for `units` of the vault's supply token,
 * guarding post-op LTV against the vault ceiling (any vault, JLP or JupSOL).
 */
const pushVaultWithdraw = (
  plan: RebalancePlan,
  v: RestoreVaultInput | undefined,
  units: number,
  label: string,
): string | null => {
  if (!v) return `No ${label} lend position found`;
  const afterUsd = v.collateralUsd - units * v.supplyPriceUsd;
  const ltvAfter = ltvOf(v, afterUsd);
  if (!(afterUsd > 0) || ltvAfter >= ltvCeiling(v)) {
    const maxUnits = Math.max(0, (v.collateralUsd - (v.debt * v.debtPriceUsd) / ltvCeiling(v)) / v.supplyPriceUsd);
    return `Withdrawing ${units.toFixed(2)} ${v.key} would push ${v.key} LTV to ${(ltvAfter * 100).toFixed(1)}% — too close to liquidation (max ≈ ${Math.floor(maxUnits * 100) / 100} ${v.key} now)`;
  }
  if (units > v.supplyAmount)
    return `Withdrawing ${units.toFixed(2)} ${v.key} exceeds the ${v.supplyAmount.toFixed(2)} held in the vault`;
  plan.positions.push(vaultDelta(v, afterUsd));
  plan.stages.push({
    type: "lend-collateral",
    key: v.key,
    vaultId: v.vaultId,
    positionId: v.positionId,
    amount: -units,
    purpose: "restore",
  });
  return null;
};

/**
 * Pure restore plan — buy: source-withdraw → swap-any → target-deposit;
 * sell: home-withdraw → swap-any → counter-deposit.
 * `sourceAmount` is already sized (buy: USDG units for kamino / JLP for lend;
 * sell: the sold amount itself); `sourceUsd` its USD value for the 20k cap.
 * Vault LTVs are recomputed for display.
 */
export function buildRestorePlan(opts: {
  target: RestoreTarget;
  source: RestoreSource;
  /** default "buy" — persisted runs and old clients keep buying */
  direction?: RestoreDirection;
  /** target token units — buy: to end up with; sell: to sell */
  amount: number;
  /** buy: sized source units (USDG kamino / JLP lend); sell: the sold amount */
  sourceAmount: number;
  /** USD value of the moved amount — 20k cap */
  sourceUsd: number;
  jlp?: RestoreVaultInput;
  jupsol?: RestoreVaultInput;
  kaminoUsdg: number;
  /** buy: quoted target units; sell: quoted counter-asset units (display/deposit) */
  estTargetOut?: number;
  /** sell only: user's Jupiter Earn EURC balance — required for eurc sells */
  earnEurc?: number;
  /** slippage bps stamped on the swap-any stage (volatile pairs) */
  slippageBps?: number;
  /** loose wallet balance of the row token — counts toward the diff:
   *  sells withdraw only the part the wallet doesn't cover, buys only
   *  buy the missing part but still deposit the full amount */
  walletBal?: number;
}): RebalancePlan {
  const { target, source, amount, sourceAmount, sourceUsd, jlp, jupsol, kaminoUsdg } = opts;
  const direction = opts.direction ?? "buy";
  const wallet = Math.max(0, opts.walletBal ?? 0);
  const plan: RebalancePlan = { positions: [], stages: [], kaminoUsdg, error: null };
  const fail = (msg: string) => {
    plan.error = msg;
    return plan;
  };

  const combos = direction === "sell" ? RESTORE_SELL_COMBOS : RESTORE_COMBOS;
  if (!combos[target]?.includes(source)) {
    const side = source === "kamino" ? "Kamino USDG" : "Lend JLP";
    return fail(
      direction === "sell"
        ? `Cannot sell ${target.toUpperCase()} to ${side}`
        : `Cannot restore ${target.toUpperCase()} from ${side}`,
    );
  }
  if (!Number.isFinite(amount) || amount <= 0) return fail("Amount must be > 0");

  if (direction === "sell") {
    if (!Number.isFinite(sourceAmount) || sourceAmount <= 0) return fail("Could not size the source amount");
    if (sourceUsd > RESTORE_MAX_USD) {
      return fail(
        `Sell exceeds the ${RESTORE_MAX_USD.toLocaleString("en-US")} USD limit (~${sourceUsd.toFixed(0)} USD)`,
      );
    }
    // home-withdraw leg — only what the loose wallet balance doesn't cover
    const W = Math.max(0, amount - wallet);
    if (W > 1e-9) {
      if (target === "usd") {
        if (!Number.isFinite(kaminoUsdg) || kaminoUsdg + 1e-9 < W) {
          return fail(`Insufficient Kamino USDG: need ~${W.toFixed(2)}, have ${(kaminoUsdg || 0).toFixed(2)}`);
        }
        plan.stages.push({
          type: "kamino-withdraw",
          amountUsdg: W,
          usdtOut: 0,
          usdgOut: W,
          purpose: "restore",
        });
      } else if (target === "eurc") {
        if (!Number.isFinite(opts.earnEurc) || (opts.earnEurc ?? 0) + 1e-9 < W) {
          return fail(`Insufficient Jupiter Earn EURC: need ~${W.toFixed(2)}, have ${(opts.earnEurc || 0).toFixed(2)}`);
        }
        plan.stages.push({ type: "earn-withdraw", token: "EURC", amount: W, purpose: "restore" });
      } else {
        const v = target === "jlp" ? jlp : jupsol;
        const err = pushVaultWithdraw(plan, v, W, target.toUpperCase());
        if (err) return fail(err);
      }
    }

    // swap leg — the exact sold amount, ExactIn
    const inToken: RestoreToken = target === "usd" ? "usdg" : target;
    const outToken: RestoreToken = source === "kamino" ? "usdg" : "jlp";
    const estOut = opts.estTargetOut;
    plan.stages.push({
      type: "swap-any",
      inToken,
      outToken,
      amount,
      estIn: amount,
      estOut,
      slippageBps: opts.slippageBps,
      purpose: "restore",
    });

    // counter-deposit leg
    if (source === "kamino") {
      plan.stages.push({
        type: "kamino-deposit",
        amountUsdg: estOut ?? amount,
        estUsdg: estOut,
        purpose: "restore",
      });
    } else {
      if (!jlp) return fail("No JLP lend position found");
      const depUsd = (estOut ?? amount) * jlp.supplyPriceUsd;
      plan.positions.push(vaultDelta(jlp, jlp.collateralUsd + depUsd));
      plan.stages.push({
        type: "lend-collateral",
        key: "JLP",
        vaultId: jlp.vaultId,
        positionId: jlp.positionId,
        amount: estOut ?? amount,
        purpose: "restore",
      });
    }
    return plan;
  }

  if (sourceUsd > RESTORE_MAX_USD) {
    return fail(
      `Restore exceeds the ${RESTORE_MAX_USD.toLocaleString("en-US")} USD limit (~${sourceUsd.toFixed(0)} USD)`,
    );
  }

  const outToken: RestoreToken = target === "usd" ? "usdg" : target;
  const inToken: RestoreToken = source === "kamino" ? "usdg" : "jlp";

  // buy only what the loose wallet balance doesn't already cover — but the
  // deposit below still places the full `amount` (wallet part included)
  const B = Math.max(0, amount - wallet);
  const T = opts.estTargetOut ?? B;
  if (B > 1e-9) {
    if (!Number.isFinite(sourceAmount) || sourceAmount <= 0) return fail("Could not size the source amount");

    // source leg
    if (source === "kamino") {
      if (!Number.isFinite(kaminoUsdg) || kaminoUsdg + 1e-9 < sourceAmount) {
        return fail(`Insufficient Kamino USDG: need ~${sourceAmount.toFixed(2)}, have ${(kaminoUsdg || 0).toFixed(2)}`);
      }
      plan.stages.push({
        type: "kamino-withdraw",
        amountUsdg: sourceAmount,
        usdtOut: 0,
        usdgOut: sourceAmount,
        purpose: "restore",
      });
    } else {
      const err = pushVaultWithdraw(plan, jlp, sourceAmount, "JLP");
      if (err) return fail(err);
    }

    // swap leg — all of the source amount, ExactIn
    plan.stages.push({
      type: "swap-any",
      inToken,
      outToken,
      amount: sourceAmount,
      estIn: sourceAmount,
      estOut: T,
      slippageBps: opts.slippageBps,
      purpose: "restore",
    });
  }

  // target leg
  if (target === "usd") {
    plan.stages.push({ type: "kamino-deposit", amountUsdg: amount, estUsdg: T, purpose: "restore" });
  } else if (target === "eurc") {
    plan.stages.push({ type: "earn-deposit", token: "EURC", amount, purpose: "restore" });
  } else {
    const v = target === "jlp" ? jlp : jupsol;
    if (!v) return fail(`No ${target.toUpperCase()} lend position found`);
    const depUsd = amount * v.supplyPriceUsd;
    plan.positions.push(vaultDelta(v, v.collateralUsd + depUsd));
    plan.stages.push({
      type: "lend-collateral",
      key: v.key,
      vaultId: v.vaultId,
      positionId: v.positionId,
      amount,
      purpose: "restore",
    });
  }
  return plan;
}

/** USD-stable mints keep the tight 0.01% swap slippage; volatile pairs get 0.05%. */
const STABLE_MINTS = new Set([
  RESTORE_TOKENS.usdg.mint,
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
]);
/** Volatile-pair slippage choices exposed in Settings (bps). */
export const SLIPPAGE_BPS_OPTIONS = [1, 5, 10, 30, 50] as const;

/** 1 bp for stablecoin-only pairs; for volatile pairs the requested bps when
 *  it is in the allow-list, else the 5 bp default. */
export const slippageBpsFor = (inMint: string, outMint: string, requested?: number): number => {
  if (STABLE_MINTS.has(inMint) && STABLE_MINTS.has(outMint)) return 1;
  return (SLIPPAGE_BPS_OPTIONS as readonly number[]).includes(requested ?? NaN) ? (requested as number) : 5;
};

const JUP_PROGRAM = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

/** Translate a known RPC simulation failure into an actionable English message;
 *  returns null for unrecognised errors (raw output is kept as-is). */
export function explainSimFailure(err: unknown, logsTail: string[], slippageBps?: number): string | null {
  const errStr = typeof err === "string" ? err : JSON.stringify(err);
  const logs = logsTail.join("\n");
  // Jupiter aggregator: SlippageToleranceExceeded (Custom 6001 / 0x1771)
  if (
    (/"Custom"\s*:\s*6001\b/.test(errStr) || /custom program error: 0x1771/i.test(logs)) &&
    (errStr.includes(JUP_PROGRAM) || logs.includes(JUP_PROGRAM))
  ) {
    const pct = slippageBps != null ? `${slippageBps / 100}%` : "the allowed slippage";
    return `Swap price moved more than ${pct} while preparing it — nothing was sent, your funds are still in your wallet. Tap Resume to retry with a fresh quote.`;
  }
  // SPL Token / Token-2022 insufficient funds; Jupiter InsufficientFunds (Custom 6024 / 0x1788)
  const jupInsufficient =
    (/"Custom"\s*:\s*6024\b/.test(errStr) || /custom program error: 0x1788/i.test(logs)) &&
    (errStr.includes(JUP_PROGRAM) || logs.includes(JUP_PROGRAM));
  if (
    jupInsufficient ||
    /insufficient funds/i.test(logs) ||
    (/"Custom"\s*:\s*1\b/.test(errStr) && /Tokenkeg|TokenzQdB/.test(logs))
  ) {
    return "Not enough balance in the wallet for this step — nothing was sent. Tap Resume to rebuild it with current balances.";
  }
  return null;
}
