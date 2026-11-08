import { WALLET } from "../config.js";
import {
  buildKaminoTx,
  buildLendTx,
  buildSwapTx,
  deserializeTx,
  fetchKaminoUsdg,
  getPlan,
  rpc,
  sendTxAndConfirm,
  simulateTx,
  sizeUsdgForUsdt,
  walletTokenBalance,
  USDG_MINT,
  USDT_MINT,
} from "./live.js";
import { distributeRepay, type LendOp, type PlanStage, type RebalancePlan } from "./plan.js";

const CAP = 1.01;

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

const checkCap = (label: string, requested: number, planned: number) => {
  if (requested > planned * CAP + 1e-9) {
    throw new HttpError(422, `${label} ${requested.toFixed(2)} exceeds plan cap ${planned.toFixed(2)}`);
  }
};

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
  const plan = await getPlan();
  const connection = rpc();
  const totalFreshRepay = plan.positions.reduce((s, p) => s + p.repayUsdt, 0);

  if (stage.type === "lend") {
    const usdtBal = await walletTokenBalance(connection, USDT_MINT);
    // pass 1: borrows clamped to fresh borrowUsdt×1.01; repays kept as candidates
    let borrowIn = 0;
    const staged = stage.ops
      .map(op => {
        const pos = plan.positions.find(p => p.key === op.key);
        if (!pos || op.deltaUsdt === 0) return null;
        if (op.deltaUsdt > 0) {
          if (pos.borrowUsdt <= 0) return null; // borrow already done — skip
          const delta = Math.min(op.deltaUsdt, pos.borrowUsdt * CAP);
          borrowIn += delta;
          return { pos, delta };
        }
        if (pos.repayUsdt <= 0) return null; // position flipped — skip stale repay
        return { pos, delta: op.deltaUsdt };
      })
      .filter((s): s is { pos: RebalancePlan["positions"][number]; delta: number } => s !== null);

    // pass 2: distribute available USDT (wallet + same-tx borrows) proportionally,
    // capped per position at debt and freshRepay×1.001 — no dust left behind
    const available = usdtBal + borrowIn;
    const repayIdx = staged.map((s, i) => (s.delta < 0 ? i : -1)).filter(i => i >= 0);
    const wants = distributeRepay(
      available,
      repayIdx.map(i => ({
        planned: Math.abs(staged[i].delta),
        debt: staged[i].pos.debt,
        freshRepay: staged[i].pos.repayUsdt,
      })),
    );

    const ops: LendOp[] = [];
    let wi = 0;
    for (const s of staged) {
      const deltaUsdt = s.delta >= 0 ? s.delta : -wants[wi++];
      if (deltaUsdt === 0) continue;
      ops.push({ key: s.pos.key, vaultId: s.pos.vaultId, positionId: s.pos.positionId, deltaUsdt });
    }
    if (ops.length === 0) throw new HttpError(422, "nothing to do — positions already at target");

    const results = await buildLendTx(
      ops.map(o => ({ vaultId: o.vaultId, positionId: o.positionId, deltaUsdt: o.deltaUsdt })),
    );
    const out: BuiltTx[] = [];
    for (const r of results) {
      const simulation = await simulateOrFail(r.txB64);
      out.push({ tx: r.txB64, size: r.size, split: r.split, simulation });
    }
    return out.length === 1 ? out[0] : out;
  }

  if (stage.type === "kamino-withdraw") {
    checkCap("withdraw usdtOut", stage.usdtOut, totalFreshRepay);
    const kamino = await fetchKaminoUsdg();
    if (!kamino.reserve) throw new HttpError(422, "no Kamino USDG deposit found");
    // size USDG needed via an ExactIn probe (Jupiter has no ExactOut routes for USDG↔USDT)
    const sized = await sizeUsdgForUsdt(stage.usdtOut);
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
      quote: { usdgIn: withdrawUnits, usdtOut: stage.usdtOut, rate: sized.rate },
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
      checkCap("swap usdg-in", stage.amount, totalFreshRepay);
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

export async function sendAction(txB64: string): Promise<{ signature: string; status: string }> {
  if (!txB64 || typeof txB64 !== "string" || txB64.length > 3000) throw new HttpError(400, "bad tx");
  const tx = deserializeTx(txB64);
  const signedBy = tx.signatures
    .map((s, i) => (s.every(b => b === 0) ? null : tx.message.staticAccountKeys[i]?.toBase58()))
    .filter(Boolean);
  if (!signedBy?.includes(WALLET)) throw new HttpError(422, "transaction not signed by expected wallet");
  return sendTxAndConfirm(txB64);
}
