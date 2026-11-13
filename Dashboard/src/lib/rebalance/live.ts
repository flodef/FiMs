import { getOperateIx } from "@jup-ag/lend/borrow";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  type AddressLookupTableAccount,
  type TransactionInstruction,
} from "@solana/web3.js";
import { KAMINO_MARKET, LTV_TARGETS, SPEND_ADDRESS, WALLET } from "../config.js";
import {
  buildPlan,
  buildTopupPlan,
  capMicroLamports,
  type FeeEstimate,
  type PlanPositionInput,
  type PlanStage,
  type RebalancePlan,
} from "./plan.js";

export const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
export const USDG_MINT = "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const DECIMALS = 6;

export const WALLET_PUB = new PublicKey(WALLET);
export const SPEND_PUB = new PublicKey(SPEND_ADDRESS);

const JUP_LEND_API = "https://api.jup.ag/lend/v1";
const JUP_SWAP_API = "https://api.jup.ag/swap/v1";
const KAMINO_KTX = "https://api.kamino.finance/ktx/klend";
const FETCH_MS = 20_000;

export function heliusUrl(): string {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error("HELIUS_API_KEY missing");
  return `https://mainnet.helius-rpc.com/?api-key=${key}`;
}

export function rpc(): Connection {
  return new Connection(heliusUrl(), "confirmed");
}

const jupKey = () => {
  const k = process.env.JUPITER_API_KEY ?? "";
  if (!k) throw new Error("JUPITER_API_KEY missing");
  return k;
};

// ---------- Jupiter Lend positions ----------

export interface LendPosition extends PlanPositionInput {
  borrowRaw: number;
}

export async function fetchLendPositions(): Promise<LendPosition[]> {
  const res = await fetch(`${JUP_LEND_API}/borrow/positions?users=${WALLET}`, {
    headers: { "x-api-key": jupKey() },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) throw new Error(`jupiter lend positions → HTTP ${res.status}`);
  const data: any = await res.json();
  const list: any[] = Array.isArray(data) ? data : (data?.positions ?? data?.data ?? []);
  const out: LendPosition[] = [];
  for (const pos of list) {
    const vault = pos.vault ?? {};
    const supply = vault.supplyToken ?? {};
    const borrow = vault.borrowToken ?? {};
    const sym = String(supply.symbol ?? "");
    if (sym !== "JLP" && sym !== "JupSOL") continue;
    if (String(borrow.symbol ?? "") !== "USDT") continue;
    const borrowRaw = Number(pos.borrow ?? 0);
    if (!(borrowRaw > 0)) continue;
    const supplyAmount = Number(pos.supply ?? 0) / 10 ** Number(supply.decimals ?? 6);
    const collateralUsd = supplyAmount * Number(supply.price ?? 0);
    const debt = borrowRaw / 10 ** Number(borrow.decimals ?? 6);
    const vaultId = Number(pos.vaultId ?? vault.id ?? vault.vaultId);
    const positionId = Number(pos.id ?? pos.positionId);
    if (!Number.isFinite(vaultId) || !Number.isFinite(positionId)) continue;
    out.push({
      key: sym,
      vaultId,
      positionId,
      collateralUsd,
      debt,
      debtPriceUsd: Number(borrow.price ?? 1),
      target: LTV_TARGETS[sym] ?? 0,
      borrowRaw,
    });
  }
  return out;
}

// ---------- Kamino USDG ----------

export interface KaminoUsdg {
  amount: number; // USDG units
  reserve: string;
}

export async function fetchKaminoUsdg(): Promise<KaminoUsdg> {
  const [oblRes, resRes] = await Promise.all([
    fetch(`https://api.kamino.finance/kamino-market/${KAMINO_MARKET}/users/${WALLET}/obligations`, {
      signal: AbortSignal.timeout(FETCH_MS),
    }),
    fetch(`https://api.kamino.finance/kamino-market/${KAMINO_MARKET}/reserves/metrics`, {
      signal: AbortSignal.timeout(FETCH_MS),
    }),
  ]);
  if (!oblRes.ok || !resRes.ok) throw new Error(`kamino → HTTP ${oblRes.status}/${resRes.status}`);
  const obligations: any = await oblRes.json();
  const reserves = ((await resRes.json()) ?? []) as any[];
  const byAddr: Record<string, any> = {};
  for (const r of reserves) byAddr[r.reserve] = r;

  let best: { reserve: string; raw: number } | null = null;
  const list = Array.isArray(obligations) ? obligations : [];
  for (const obl of list) {
    for (const d of obl?.state?.deposits ?? []) {
      if (!d.depositReserve || d.depositReserve.startsWith("11111111")) continue;
      const r = byAddr[d.depositReserve];
      if (!r || String(r.liquidityToken ?? "").toUpperCase() !== "USDG") continue;
      const raw = Number(d.depositedAmount || 0);
      if (raw > (best?.raw ?? 0)) best = { reserve: d.depositReserve, raw };
    }
  }
  if (!best) return { amount: 0, reserve: "" };
  // exchange rate via metrics history (same as sources/kamino.ts)
  let rate = 1;
  try {
    const h = await fetch(
      `https://api.kamino.finance/kamino-market/${KAMINO_MARKET}/reserves/${best.reserve}/metrics/history`,
      { signal: AbortSignal.timeout(FETCH_MS) },
    );
    const hist = ((await h.json()) as any)?.history ?? [];
    const r = Number(hist[hist.length - 1]?.metrics?.exchangeRate);
    if (r > 0) rate = r;
  } catch {
    /* keep 1 */
  }
  return { amount: best.raw / 1e6 / rate, reserve: best.reserve };
}

export async function getPlan(): Promise<RebalancePlan> {
  const [positions, kamino] = await Promise.all([fetchLendPositions(), fetchKaminoUsdg()]);
  const plan = buildPlan(positions, kamino.amount);
  await annotateWithQuotes(plan).catch(() => {});
  plan.feeEstimate = await computeFeeEstimate(plan.stages).catch(() => undefined);
  return plan;
}

export async function getTopupPlan(usdt: number): Promise<RebalancePlan> {
  const kamino = await fetchKaminoUsdg();
  const plan = buildTopupPlan(usdt, kamino.amount);
  await annotateWithQuotes(plan).catch(() => {});
  plan.feeEstimate = await computeFeeEstimate(plan.stages).catch(() => undefined);
  return plan;
}

// ---------- fee estimation ----------

const BASE_FEE_LAMPORTS = 5_000;
const MAX_PRIORITY_LAMPORTS = 1_000;
const EST_CU_PER_TX = 150_000;

let mediumMicroCache: { at: number; micro: number } | null = null;

/** Helius getPriorityFeeEstimate at "medium" level → µL/CU, clamped [1,1000], fallback 5. */
export async function priorityMicroLamports(txB64: string): Promise<number> {
  try {
    const res = await fetch(heliusUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getPriorityFeeEstimate",
        params: [{ transaction: txB64, options: { transactionEncoding: "base64", priorityLevel: "Medium" } }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json: any = await res.json();
    const v = Number(json?.result?.priorityFeeEstimate ?? json?.result?.priorityFeeLevels?.medium);
    if (Number.isFinite(v) && v > 0) return Math.min(1000, Math.max(1, Math.round(v)));
  } catch {
    /* fall through */
  }
  return 5;
}

/** Medium priority fee estimate, cached 60 s (needs a probe tx — built once). */
async function estimateMediumMicro(): Promise<number> {
  if (mediumMicroCache && Date.now() - mediumMicroCache.at < 60_000) return mediumMicroCache.micro;
  const connection = rpc();
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({
    payerKey: WALLET_PUB,
    recentBlockhash: blockhash,
    instructions: [ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 })],
  }).compileToV0Message([]);
  const probeB64 = Buffer.from(new VersionedTransaction(msg).serialize()).toString("base64");
  const micro = await priorityMicroLamports(probeB64);
  mediumMicroCache = { at: Date.now(), micro };
  return micro;
}

async function computeFeeEstimate(stages: PlanStage[]): Promise<FeeEstimate> {
  const txCount = stages.length;
  const prioCount = stages.filter(s => s.type === "lend" || s.type === "swap" || s.type === "spend-transfer").length;
  let micro = 5;
  try {
    micro = await estimateMediumMicro();
  } catch {
    /* keep 5 */
  }
  const perTx = Math.min(
    MAX_PRIORITY_LAMPORTS,
    Math.ceil((capMicroLamports(micro, EST_CU_PER_TX) * EST_CU_PER_TX) / 1e6),
  );
  return {
    lamports: BASE_FEE_LAMPORTS * txCount + prioCount * perTx,
    maxLamports: (BASE_FEE_LAMPORTS + MAX_PRIORITY_LAMPORTS) * txCount,
  };
}

/** Fill display-only USDG/USDT estimates from live Jupiter quotes (validated amounts stay untouched). */
async function annotateWithQuotes(plan: RebalancePlan): Promise<void> {
  const withdraw = plan.stages.find(s => s.type === "kamino-withdraw");
  if (withdraw?.type === "kamino-withdraw") {
    const sized = await sizeUsdgForUsdt(withdraw.usdtOut);
    withdraw.amountUsdg = sized.usdg;
    for (const s of plan.stages) {
      if (s.type === "swap" && s.pair === "usdg-usdt") {
        s.estIn = sized.usdg;
        s.estOut = sized.usdg * sized.rate;
      }
    }
  }
  const toUsdg = plan.stages.find(s => s.type === "swap" && s.pair === "usdt-usdg");
  if (toUsdg?.type === "swap") {
    const q = await jupQuote(USDT_MINT, USDG_MINT, Math.round(toUsdg.amount * 1e6), "ExactIn");
    toUsdg.estIn = toUsdg.amount;
    toUsdg.estOut = q.outAmount / 1e6;
    for (const s of plan.stages) if (s.type === "kamino-deposit") s.estUsdg = toUsdg.estOut;
  }
}

// ---------- RPC token balances ----------

export async function walletTokenBalance(connection: Connection, mint: string): Promise<number> {
  const res = await connection.getParsedTokenAccountsByOwner(WALLET_PUB, { mint: new PublicKey(mint) });
  let total = 0;
  for (const { account } of res.value) {
    const amt = (account.data as any)?.parsed?.info?.tokenAmount?.uiAmount;
    if (Number.isFinite(amt)) total += Number(amt);
  }
  return total;
}

// ---------- Jupiter Lend tx ----------

export interface LendTxResult {
  txB64: string;
  size: number;
  split: boolean;
  units?: number;
  microLamports?: number;
}

async function lendTxForOps(
  connection: Connection,
  ops: { vaultId: number; positionId: number; deltaUsdt: number }[],
): Promise<{ ixs: TransactionInstruction[]; alts: AddressLookupTableAccount[] }> {
  const ixs: TransactionInstruction[] = [];
  const altMap = new Map<string, AddressLookupTableAccount>();
  for (const op of ops) {
    const raw = Math.trunc(op.deltaUsdt * 10 ** DECIMALS);
    if (raw === 0) continue;
    const res = await getOperateIx({
      vaultId: op.vaultId,
      positionId: op.positionId,
      colAmount: new BN(0),
      debtAmount: new BN(raw),
      connection,
      signer: WALLET_PUB,
      market: "main",
    });
    ixs.push(...res.ixs);
    for (const a of res.addressLookupTableAccounts) altMap.set(a.key.toBase58(), a);
  }
  return { ixs, alts: [...altMap.values()] };
}

const MAX_TX_BYTES = 1232;

async function assembleTx(
  connection: Connection,
  ixs: TransactionInstruction[],
  alts: AddressLookupTableAccount[],
  units: number,
  microLamports: number,
): Promise<VersionedTransaction> {
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({
    payerKey: WALLET_PUB,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
      ...ixs,
    ],
  }).compileToV0Message(alts);
  return new VersionedTransaction(msg);
}

/**
 * Build → probe-simulate (generous CU limit) → rebuild with CU = units×1.15 and
 * the Helius "medium" priority price capped so the fee stays ≤ 1000 lamports.
 */
async function finalizeTx(
  connection: Connection,
  ixs: TransactionInstruction[],
  alts: AddressLookupTableAccount[] = [],
): Promise<LendTxResult> {
  const probe = await assembleTx(connection, ixs, alts, 1_400_000, 0);
  const probeB64 = Buffer.from(probe.serialize()).toString("base64");
  let units = 400_000;
  try {
    const sim = await connection.simulateTransaction(probe, { sigVerify: false, replaceRecentBlockhash: true });
    if (sim.value.unitsConsumed && sim.value.unitsConsumed > 0) {
      units = Math.ceil(sim.value.unitsConsumed * 1.15);
    }
  } catch {
    /* keep 400k */
  }
  const microLamports = capMicroLamports(await priorityMicroLamports(probeB64), units);
  const tx = await assembleTx(connection, ixs, alts, units, microLamports);
  const raw = tx.serialize();
  return { txB64: Buffer.from(raw).toString("base64"), size: raw.length, split: false, units, microLamports };
}

export async function buildLendTx(
  ops: { vaultId: number; positionId: number; deltaUsdt: number }[],
): Promise<LendTxResult[]> {
  const connection = rpc();
  const { ixs, alts } = await lendTxForOps(connection, ops);
  if (!ixs.length) throw new Error("lend: no instructions");
  const combined = await finalizeTx(connection, ixs, alts);
  if (combined.size <= MAX_TX_BYTES) {
    return [{ ...combined, split: false }];
  }
  // too big — split per position
  const activeOps = ops.filter(o => Math.trunc(o.deltaUsdt * 10 ** DECIMALS) !== 0);
  const results: LendTxResult[] = [];
  for (const op of activeOps) {
    const one = await lendTxForOps(connection, [op]);
    results.push({ ...(await finalizeTx(connection, one.ixs, one.alts)), split: true });
  }
  return results;
}

/**
 * USDT transfer to the Jupiter Spend address: idempotent dest ATA create +
 * transferChecked from the wallet's USDT ATA. Same probe-sim → tight CU budget.
 */
export async function buildSpendTransferTx(amountUsdt: number): Promise<LendTxResult> {
  const connection = rpc();
  const raw = Math.round(amountUsdt * 10 ** DECIMALS);
  if (!(raw > 0)) throw new Error("spend-transfer: amount must be > 0");
  const usdtMint = new PublicKey(USDT_MINT);
  const walletAta = getAssociatedTokenAddressSync(usdtMint, WALLET_PUB);
  // SPEND_ADDRESS is off-curve (Jupiter Spend PDA) → allowOwnerOffCurve required
  const destAta = getAssociatedTokenAddressSync(usdtMint, SPEND_PUB, true);
  const ixs = [
    createAssociatedTokenAccountIdempotentInstruction(WALLET_PUB, destAta, SPEND_PUB, usdtMint),
    createTransferCheckedInstruction(walletAta, usdtMint, destAta, WALLET_PUB, raw, DECIMALS),
  ];
  return finalizeTx(connection, ixs);
}

// ---------- Jupiter swap ----------

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: number; // raw
  outAmount: number; // raw
  /** verbatim API response — required by /swap (string amounts) */
  raw: Record<string, unknown>;
}

export async function jupQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  swapMode: "ExactIn" | "ExactOut",
): Promise<SwapQuote> {
  const qs = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(Math.round(amount)),
    swapMode,
    slippageBps: "1",
  });
  const res = await fetch(`${JUP_SWAP_API}/quote?${qs}`, {
    headers: { "x-api-key": jupKey() },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`jup quote → HTTP ${res.status}: ${body.slice(0, 160)}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    inputMint,
    outputMint,
    inAmount: Number(raw.inAmount),
    outAmount: Number(raw.outAmount),
    raw,
  };
}

/**
 * Jupiter has no ExactOut routes for USDG↔USDT — size the Kamino withdraw with an
 * ExactIn probe instead: quote ~usdtOut USDG→USDT, derive the rate, add 0.01%.
 */
export async function sizeUsdgForUsdt(usdtOut: number): Promise<{ usdg: number; rate: number }> {
  const probe = await jupQuote(USDG_MINT, USDT_MINT, Math.max(1, Math.round(usdtOut * 1e6)), "ExactIn");
  const rate = probe.outAmount / probe.inAmount; // USDT raw per USDG raw
  if (!(rate > 0)) throw new Error("jup quote: zero rate");
  const usdgRaw = Math.ceil((usdtOut * 1e6 * 1.0001) / rate);
  return { usdg: usdgRaw / 1e6, rate };
}

export async function buildSwapTx(
  inputMint: string,
  outputMint: string,
  amountRaw: number,
  swapMode: "ExactIn" | "ExactOut" = "ExactIn",
): Promise<{ txB64: string; size: number; quote: SwapQuote }> {
  const quote = await jupQuote(inputMint, outputMint, amountRaw, swapMode);
  const post = (feeField: Record<string, unknown>) =>
    fetch(`${JUP_SWAP_API}/swap`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": jupKey() },
      body: JSON.stringify({
        quoteResponse: quote.raw,
        userPublicKey: WALLET,
        dynamicComputeUnitLimit: true,
        ...feeField,
      }),
      signal: AbortSignal.timeout(FETCH_MS),
    });
  // explicit Helius "medium" µL/CU price capped at 1000 lamports (Jupiter's dynamic
  // CU limit can reach ~1.4M → price ≤ 714 µL/CU) — cheapest reliable option
  const micro = capMicroLamports(await estimateMediumMicro().catch(() => 5), 1_400_000);
  let res = await post({ computeUnitPriceMicroLamports: micro });
  if (!res.ok) {
    // fallback: Jupiter's capped medium priority level
    res = await post({
      prioritizationFeeLamports: { priorityLevelWithMaxLamports: { priorityLevel: "medium", maxLamports: 1000 } },
    });
  }
  if (!res.ok) throw new Error(`jup swap → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body: any = await res.json();
  const b64 = body.swapTransaction;
  if (!b64) throw new Error("jup swap: no swapTransaction");
  return { txB64: b64, size: Buffer.from(b64, "base64").length, quote };
}

// ---------- Kamino KTX ----------

export async function buildKaminoTx(
  action: "deposit" | "withdraw",
  amount: number,
  reserve: string,
): Promise<{ txB64: string; size: number }> {
  const res = await fetch(`${KAMINO_KTX}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      wallet: WALLET,
      market: KAMINO_MARKET,
      reserve,
      amount: amount.toFixed(DECIMALS),
    }),
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) throw new Error(`kamino ${action} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body: any = await res.json();
  const b64 = body.transaction ?? body.tx ?? body.swapTransaction;
  if (!b64) throw new Error(`kamino ${action}: no transaction in response (${JSON.stringify(Object.keys(body))})`);
  return { txB64: b64, size: Buffer.from(b64, "base64").length };
}

// ---------- simulate / send ----------

export function deserializeTx(b64: string): VersionedTransaction {
  const raw = Buffer.from(b64, "base64");
  try {
    return VersionedTransaction.deserialize(raw);
  } catch {
    // jup/kamino may return legacy txs — rewrap as v0
    const legacy = Transaction.from(raw);
    return new VersionedTransaction(legacy.compileMessage());
  }
}

export async function simulateTx(txB64: string) {
  const connection = rpc();
  const tx = deserializeTx(txB64);
  const sim = await connection.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true });
  return {
    ok: sim.value.err === null,
    err: sim.value.err,
    logsTail: (sim.value.logs ?? []).slice(-12),
    unitsConsumed: sim.value.unitsConsumed ?? null,
  };
}

export async function sendTxAndConfirm(txB64: string): Promise<{ signature: string; status: string }> {
  const connection = rpc();
  const tx = deserializeTx(txB64);
  const raw = tx.serialize();
  const signature = await connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });
  const deadline = Date.now() + 45_000;
  let status = "pending";
  while (Date.now() < deadline) {
    const st = await connection.getSignatureStatuses([signature]);
    const s = st.value[0];
    if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
      status = s.err ? `failed: ${JSON.stringify(s.err)}` : s.confirmationStatus;
      return { signature, status };
    }
    if (s?.err) return { signature, status: `failed: ${JSON.stringify(s.err)}` };
    await new Promise(r => setTimeout(r, 2000));
  }
  return { signature, status };
}
