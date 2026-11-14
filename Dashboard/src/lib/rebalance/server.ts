import { WALLET } from "../config.js";
import {
  buildKaminoTx,
  buildLendTxFitted,
  buildSpendTransferTx,
  buildSwapTx,
  deserializeTx,
  fetchKaminoUsdg,
  getPlan,
  getTopupPlan,
  rpc,
  sendTxAndConfirm,
  simulateTx,
  sizeUsdgForUsdt,
  statusTxAndConfirm,
  walletTokenBalance,
  walletTokenBalanceRaw,
  USDG_MINT,
  USDT_MINT,
} from "./live.js";
import { distributeRepayRaw, TOPUP_MAX_USDT, type LendOp, type PlanStage, type RebalancePlan } from "./plan.js";

const CAP = 1.01;
const TOPUP_SWAP_CAP = 1.005;
const TOPUP_TRANSFER_CAP = 1.005;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function planAction(): Promise<RebalancePlan> {
  return getPlan();
}

export async function topupPlanAction(usdt: number): Promise<RebalancePlan> {
  return getTopupPlan(usdt);
}

interface BuiltTx {
  tx: string;
  size: number;
  split?: boolean;
  quote?: unknown;
  simulation: { ok: boolean; err: unknown; logsTail: string[]; unitsConsumed: number | null };
}

async function simulateOrFail(tx: string) {
  const s = await simulateTx(tx);
  if (!s.ok) {
    throw new HttpError(422, `simulation failed: ${JSON.stringify(s.err)}\n${s.logsTail.slice(-5).join("\n")}`);
  }
  return s;
}

/**
 * Build one stage. The client-sent stage is validated against a FRESH plan by
 * type + per-position deltas — never by stage index, so mid-run re-plans can't
 * strand funds or repeat completed work.
 */
export async function buildAction(stage: PlanStage): Promise<BuiltTx | BuiltTx[]> {
  if (stage.purpose === "topup" || stage.type === "spend-transfer") {
    return buildTopupStage(stage);
  }
  const plan = await getPlan();
  const connection = rpc();
  const totalFreshRepay = plan.positions.reduce((s, p) => s + p.repayUsdt, 0);

  if (stage.type === "lend") {
    const usdtBalRaw = await walletTokenBalanceRaw(connection, USDT_MINT);
    // pass 1: borrows clamped to fresh borrowUsdt×1.01; repays kept as candidates
    let borrowInRaw = 0;
    const staged = stage.ops
      .map(op => {
        const pos = plan.positions.find(p => p.key === op.key);
        if (!pos || op.deltaUsdt === 0) return null;
        if (op.deltaUsdt > 0) {
          if (pos.borrowUsdt <= 0) return null; // borrow already done — skip
          const delta = Math.min(op.deltaUsdt, pos.borrowUsdt * CAP);
          borrowInRaw += Math.trunc(delta * 1e6); // exact raw the tx will request
          return { pos, delta };
        }
        if (pos.repayUsdt <= 0) return null; // position flipped — skip stale repay
        return { pos, delta: op.deltaUsdt };
      })
      .filter((s): s is { pos: RebalancePlan["positions"][number]; delta: number } => s !== null);

    // pass 2: distribute available USDT (wallet + same-tx borrows) proportionally
    // in exact raw units — sum equals the balance whenever caps allow it, so the
    // fitted builder can drive the post-tx ATA balance to 0 (no dust)
    const availableRaw = usdtBalRaw + borrowInRaw;
    const repayIdx = staged.map((s, i) => (s.delta < 0 ? i : -1)).filter(i => i >= 0);
    const wantsRaw = distributeRepayRaw(
      availableRaw,
      repayIdx.map(i => {
        const s = staged[i];
        const capUsdt = Math.max(s.pos.repayUsdt, Math.abs(s.delta)) * 1.001;
        return {
          plannedRaw: Math.max(1, Math.round(Math.abs(s.delta) * 1e6)),
          capRaw: Math.min(Math.round(s.pos.debt * 1e6), Math.floor(capUsdt * 1e6)),
        };
      }),
    );

    const ops: (LendOp & { deltaRawUsdt: number })[] = [];
    let wi = 0;
    for (const s of staged) {
      if (s.delta >= 0) {
        const deltaRawUsdt = Math.trunc(s.delta * 1e6);
        if (deltaRawUsdt === 0) continue;
        ops.push({
          key: s.pos.key,
          vaultId: s.pos.vaultId,
          positionId: s.pos.positionId,
          deltaUsdt: s.delta,
          deltaRawUsdt,
        });
      } else {
        const raw = wantsRaw[wi++];
        if (raw === 0) continue;
        ops.push({
          key: s.pos.key,
          vaultId: s.pos.vaultId,
          positionId: s.pos.positionId,
          deltaUsdt: -raw / 1e6,
          deltaRawUsdt: -raw,
        });
      }
    }
    if (ops.length === 0) throw new HttpError(422, "nothing to do — positions already at target");

    let results: Awaited<ReturnType<typeof buildLendTxFitted>>;
    try {
      results = await buildLendTxFitted(
        ops.map(o => ({
          vaultId: o.vaultId,
          positionId: o.positionId,
          deltaUsdt: o.deltaUsdt,
          deltaRawUsdt: o.deltaRawUsdt,
        })),
        availableRaw,
      );
    } catch (e: any) {
      throw new HttpError(422, String(e?.message ?? e));
    }
    const out: BuiltTx[] = [];
    for (const r of results) {
      const simulation = await simulateOrFail(r.txB64);
      out.push({ tx: r.txB64, size: r.size, split: r.split, simulation });
    }
    return out.length === 1 ? out[0] : out;
  }

  if (stage.type === "kamino-withdraw") {
    // prices move between plan and build: clamp to the fresh need instead of rejecting
    const usdtOut = Math.min(stage.usdtOut, totalFreshRepay);
    if (usdtOut < 1) throw new HttpError(422, "nothing to withdraw — positions already at target");
    const kamino = await fetchKaminoUsdg();
    if (!kamino.reserve) throw new HttpError(422, "no Kamino USDG deposit found");
    // size USDG needed via an ExactIn probe (Jupiter has no ExactOut routes for USDG↔USDT)
    const sized = await sizeUsdgForUsdt(usdtOut);
    const withdrawUnits = sized.usdg;
    const kaminoRaw = kamino.amount * 1e6;
    if (withdrawUnits * 1e6 > kaminoRaw) {
      throw new HttpError(
        422,
        `Kamino USDG insufficient: need ~${withdrawUnits.toFixed(2)}, have ${kamino.amount.toFixed(2)}`,
      );
    }
    const built = await buildKaminoTx("withdraw", withdrawUnits, kamino.reserve);
    const simulation = await simulateOrFail(built.txB64);
    return {
      tx: built.txB64,
      size: built.size,
      quote: { usdgIn: withdrawUnits, usdtOut, rate: sized.rate },
      simulation,
    };
  }

  if (stage.type === "swap") {
    const usdtBal = await walletTokenBalance(connection, USDT_MINT);
    const usdgBal = await walletTokenBalance(connection, USDG_MINT);
    let inputMint: string;
    let outputMint: string;
    let amountRaw: number;
    if (stage.pair === "usdg-usdt") {
      // repay path: withdrawn USDG ≈ plan + ~0.5% (rate + buffer) — swap ALL of it
      inputMint = USDG_MINT;
      outputMint = USDT_MINT;
      amountRaw = Math.min(Math.round(stage.amount * 1.005 * 1e6), Math.floor(usdgBal * 1e6));
    } else {
      // margin path: positions already moved — no plan cap, just don't overspend wallet
      inputMint = USDT_MINT;
      outputMint = USDG_MINT;
      amountRaw = Math.min(Math.round(stage.amount * 1.001 * 1e6), Math.floor(usdtBal * 1e6));
    }
    if (amountRaw <= 0) throw new HttpError(422, "wallet balance too low for swap");
    const built = await buildSwapTx(inputMint, outputMint, amountRaw, "ExactIn");
    const simulation = await simulateOrFail(built.txB64);
    return {
      tx: built.txB64,
      size: built.size,
      quote: { inAmount: built.quote.inAmount / 1e6, outAmount: built.quote.outAmount / 1e6 },
      simulation,
    };
  }

  if (stage.type === "kamino-deposit") {
    const usdgBal = await walletTokenBalance(connection, USDG_MINT);
    const amount = Math.min(stage.amountUsdg * 1.001, usdgBal);
    if (amount <= 0) throw new HttpError(422, "wallet USDG balance is 0");
    const kamino = await fetchKaminoUsdg();
    if (!kamino.reserve) throw new HttpError(422, "no Kamino USDG reserve found");
    const built = await buildKaminoTx("deposit", amount, kamino.reserve);
    const simulation = await simulateOrFail(built.txB64);
    return { tx: built.txB64, size: built.size, simulation };
  }

  throw new HttpError(422, "unsupported stage");
}

/**
 * Top-up stages (purpose "topup" / spend-transfer): same builders as rebalance but
 * validated against the client-sent amounts + hard 10k cap — no lend-position plan.
 */
async function buildTopupStage(stage: PlanStage): Promise<BuiltTx> {
  const connection = rpc();

  if (stage.type === "kamino-withdraw") {
    const usdtOut = Math.min(stage.usdtOut, TOPUP_MAX_USDT);
    if (usdtOut < 1) throw new HttpError(422, "top-up amount must be ≥ 1 USDT");
    const kamino = await fetchKaminoUsdg();
    if (!kamino.reserve) throw new HttpError(422, "no Kamino USDG deposit found");
    const sized = await sizeUsdgForUsdt(usdtOut);
    const withdrawUnits = sized.usdg;
    if (withdrawUnits * 1e6 > kamino.amount * 1e6) {
      throw new HttpError(
        422,
        `Kamino USDG insufficient: need ~${withdrawUnits.toFixed(2)}, have ${kamino.amount.toFixed(2)}`,
      );
    }
    const built = await buildKaminoTx("withdraw", withdrawUnits, kamino.reserve);
    const simulation = await simulateOrFail(built.txB64);
    return {
      tx: built.txB64,
      size: built.size,
      quote: { usdgIn: withdrawUnits, usdtOut, rate: sized.rate },
      simulation,
    };
  }

  if (stage.type === "swap" && stage.pair === "usdg-usdt") {
    const usdgBal = await walletTokenBalance(connection, USDG_MINT);
    const amountRaw = Math.min(Math.round(stage.amount * TOPUP_SWAP_CAP * 1e6), Math.floor(usdgBal * 1e6));
    if (amountRaw <= 0) throw new HttpError(422, "wallet USDG balance too low for swap");
    const built = await buildSwapTx(USDG_MINT, USDT_MINT, amountRaw, "ExactIn");
    const simulation = await simulateOrFail(built.txB64);
    return {
      tx: built.txB64,
      size: built.size,
      quote: { inAmount: built.quote.inAmount / 1e6, outAmount: built.quote.outAmount / 1e6 },
      simulation,
    };
  }

  if (stage.type === "spend-transfer") {
    const usdtBal = await walletTokenBalance(connection, USDT_MINT);
    const amount = Math.min(Math.min(stage.usdt, TOPUP_MAX_USDT) * TOPUP_TRANSFER_CAP, usdtBal);
    if (amount <= 0) throw new HttpError(422, "wallet USDT balance too low for transfer");
    const built = await buildSpendTransferTx(amount);
    const simulation = await simulateOrFail(built.txB64);
    return { tx: built.txB64, size: built.size, quote: { usdt: amount }, simulation };
  }

  throw new HttpError(422, "unsupported top-up stage");
}

function validatedSignedTx(txB64: unknown): string {
  if (typeof txB64 !== "string" || !txB64 || txB64.length > 3000) throw new HttpError(400, "bad tx");
  const tx = deserializeTx(txB64);
  const signedBy = tx.signatures
    .map((s, i) => (s.every(b => b === 0) ? null : tx.message.staticAccountKeys[i]?.toBase58()))
    .filter(Boolean);
  if (!signedBy?.includes(WALLET)) throw new HttpError(422, "transaction not signed by expected wallet");
  return txB64;
}

export async function sendAction(txB64: unknown): Promise<{ signature: string; status: string }> {
  return sendTxAndConfirm(validatedSignedTx(txB64));
}

/** Re-check a previously sent signed tx (rebroadcast + poll, no initial send). */
export async function statusAction(txB64: unknown): Promise<{ signature: string; status: string }> {
  return statusTxAndConfirm(validatedSignedTx(txB64));
}
