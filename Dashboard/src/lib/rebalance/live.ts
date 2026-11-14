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
import bs58 from "bs58";
import { KAMINO_MARKET, LTV_TARGETS, SPEND_ADDRESS, WALLET } from "../config.js";
import {
  buildPlan,
  buildTopupPlan,
  priorityMicroLamports,
  type PlanPositionInput,
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
  return plan;
}

export async function getTopupPlan(usdt: number): Promise<RebalancePlan> {
  const kamino = await fetchKaminoUsdg();
  const plan = buildTopupPlan(usdt, kamino.amount);
  await annotateWithQuotes(plan).catch(() => {});
  return plan;
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

/** Exact raw token balance (smallest units) — no float drift. */
export async function walletTokenBalanceRaw(connection: Connection, mint: string): Promise<number> {
  const res = await connection.getParsedTokenAccountsByOwner(WALLET_PUB, { mint: new PublicKey(mint) });
  let total = 0;
  for (const { account } of res.value) {
    const amt = (account.data as any)?.parsed?.info?.tokenAmount?.amount;
    if (amt != null && /^\d+$/.test(String(amt))) total += Number(amt);
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

export interface LendBuildOp {
  vaultId: number;
  positionId: number;
  deltaUsdt: number;
  /** exact raw delta (1e-6 USDT, signed) — takes precedence over deltaUsdt */
  deltaRawUsdt?: number;
}

const opRaw = (op: LendBuildOp) => op.deltaRawUsdt ?? Math.trunc(op.deltaUsdt * 10 ** DECIMALS);

async function lendTxForOps(
  connection: Connection,
  ops: LendBuildOp[],
): Promise<{ ixs: TransactionInstruction[]; alts: AddressLookupTableAccount[] }> {
  const ixs: TransactionInstruction[] = [];
  const altMap = new Map<string, AddressLookupTableAccount>();
  for (const op of ops) {
    const raw = opRaw(op);
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
 * the fixed 1-lamport priority fee (µL/CU derived from the CU limit).
 */
async function finalizeTx(
  connection: Connection,
  ixs: TransactionInstruction[],
  alts: AddressLookupTableAccount[] = [],
): Promise<LendTxResult> {
  const probe = await assembleTx(connection, ixs, alts, 1_400_000, 0);
  let units = 400_000;
  try {
    const sim = await connection.simulateTransaction(probe, { sigVerify: false, replaceRecentBlockhash: true });
    if (sim.value.unitsConsumed && sim.value.unitsConsumed > 0) {
      units = Math.ceil(sim.value.unitsConsumed * 1.15);
    }
  } catch {
    /* keep 400k */
  }
  const microLamports = priorityMicroLamports(units);
  const tx = await assembleTx(connection, ixs, alts, units, microLamports);
  const raw = tx.serialize();
  return { txB64: Buffer.from(raw).toString("base64"), size: raw.length, split: false, units, microLamports };
}

export async function buildLendTx(ops: LendBuildOp[]): Promise<LendTxResult[]> {
  const connection = rpc();
  const { ixs, alts } = await lendTxForOps(connection, ops);
  if (!ixs.length) throw new Error("lend: no instructions");
  const combined = await finalizeTx(connection, ixs, alts);
  if (combined.size <= MAX_TX_BYTES) {
    return [{ ...combined, split: false }];
  }
  // too big — split per position
  const activeOps = ops.filter(o => opRaw(o) !== 0);
  const results: LendTxResult[] = [];
  for (const op of activeOps) {
    const one = await lendTxForOps(connection, [op]);
    results.push({ ...(await finalizeTx(connection, one.ixs, one.alts)), split: true });
  }
  return results;
}

// ---------- exact-fit repay ----------

const USDT_MINT_PUB = new PublicKey(USDT_MINT);
const USDT_ATA = getAssociatedTokenAddressSync(USDT_MINT_PUB, WALLET_PUB);

interface UsdtPostSim {
  ok: boolean;
  err: unknown;
  logs: string[];
  /** wallet USDT ATA raw balance after the simulated tx (null = account gone) */
  postRaw: number | null;
}

/** Simulate a tx and decode the wallet USDT ATA's post-execution raw balance. */
async function simulateUsdtPost(txB64: string): Promise<UsdtPostSim> {
  const connection = rpc();
  const tx = deserializeTx(txB64);
  const sim = await connection.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    accounts: { encoding: "base64", addresses: [USDT_ATA.toBase58()] },
  });
  let postRaw: number | null = null;
  const acc = sim.value.accounts?.[0] as any;
  // RPC returns data as [payload, encoding] tuple or a raw buffer
  let data: unknown = acc?.data;
  if (Array.isArray(data)) data = data[0];
  const buf =
    typeof data === "string" ? Buffer.from(data, "base64") : data instanceof Uint8Array ? Buffer.from(data) : null;
  if (buf && buf.length >= 72) postRaw = Number(buf.readBigUInt64LE(64)); // SPL amount @ offset 64
  return { ok: sim.value.err === null, err: sim.value.err, logs: sim.value.logs ?? [], postRaw };
}

const isInsufficientFunds = (sim: UsdtPostSim): boolean => {
  const errStr = JSON.stringify(sim.err ?? "");
  const custom1 = /"Custom":\s*1\b/.test(errStr);
  return custom1 || sim.logs.some(l => /insufficient funds/i.test(l));
};

/**
 * buildLendTx + exact-balance fitting for the repay path. Jupiter Lend rounds
 * each repay internally by ~1 raw unit, so the exact split that fits can't be
 * derived analytically — instead we let the chain decide: simulate with the
 * wallet USDT ATA post-state and nudge the largest repay op by ±raw units.
 *
 * Only runs when the distributed repay total equals `availableRaw` (wallet
 * USDT is the limiting factor); capped repays keep the plain build.
 */
export async function buildLendTxFitted(ops: LendBuildOp[], availableRaw?: number): Promise<LendTxResult[]> {
  const repayIdx = ops.map((o, i) => (opRaw(o) < 0 ? i : -1)).filter(i => i >= 0);
  const repaySum = -repayIdx.reduce((s, i) => s + opRaw(ops[i]), 0);
  if (availableRaw == null || !repayIdx.length || repaySum !== Math.floor(availableRaw)) {
    return buildLendTx(ops);
  }

  const raws = ops.map(opRaw);
  const largestRepay = () => {
    let li = repayIdx[0];
    for (const i of repayIdx) if (Math.abs(raws[i]) > Math.abs(raws[li])) li = i;
    return li;
  };
  const opsWith = (r: number[]) => ops.map((o, i) => ({ ...o, deltaRawUsdt: r[i] }));

  let best: { results: LendTxResult[]; postRaw: number } | null = null;
  let addsLeft = 2;
  // stay well inside the 60 s function limit (each rebuild hits the Jupiter API)
  const deadline = Date.now() + 40_000;
  for (let iter = 0; iter < 12 && Date.now() < deadline; iter++) {
    const results = await buildLendTx(opsWith(raws));
    const sim = await simulateUsdtPost(results[results.length - 1].txB64);
    if (sim.ok) {
      const post = sim.postRaw ?? 0;
      if (!best || post < best.postRaw) best = { results, postRaw: post };
      if (post === 0 || addsLeft <= 0) return best.results;
      addsLeft--;
      raws[largestRepay()] -= post; // repay raw is negative → repay `post` more
      continue;
    }
    if (isInsufficientFunds(sim)) {
      const li = largestRepay();
      if (raws[li] >= 0) return results; // can't shrink further without flipping sign
      raws[li] += 1; // repay 1 raw unit less and retry
      continue;
    }
    return results; // non-funding failure — let simulateOrFail report it
  }
  if (best) return best.results;
  throw new Error("lend repay fit failed: no passing variant in time — tap Resume to retry");
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

const CB_PROGRAM = ComputeBudgetProgram.programId.toBase58();

/** Read CU limit + SetComputeUnitPrice index from a compiled tx message. */
function computeBudgetIxs(tx: VersionedTransaction) {
  const msg: any = tx.message;
  const keys = msg.staticAccountKeys ?? msg.accountKeys;
  const ixs = msg.compiledInstructions ?? msg.instructions ?? [];
  let limit = 0;
  let priceIdx = -1;
  ixs.forEach((ix: any, i: number) => {
    const prog = keys[ix.programIdIndex]?.toBase58?.() ?? keys[ix.programIdIndex];
    if (prog !== CB_PROGRAM) return;
    const d = Buffer.isBuffer(ix.data) ? ix.data : Buffer.from(ix.data ?? []);
    if (d[0] === 2) limit = d.readUInt32LE(1);
    if (d[0] === 3) priceIdx = i;
  });
  return { ixs, keys, limit, priceIdx };
}

/**
 * Jupiter builds the swap tx with whatever CU limit it wants — we can't know it
 * upfront, so request price=1, then rewrite the SetComputeUnitPrice instruction
 * in place to floor(1 lamport / cuLimit). Same ix, same byte length.
 */
async function rewriteSwapPriority(txB64: string): Promise<string> {
  const tx = deserializeTx(txB64);
  const { ixs, limit, priceIdx } = computeBudgetIxs(tx);
  if (limit > 0 && priceIdx >= 0) {
    const micro = priorityMicroLamports(limit);
    const d = Buffer.alloc(9);
    d[0] = 3; // SetComputeUnitPrice
    d.writeBigUInt64LE(BigInt(micro), 1);
    ixs[priceIdx].data = new Uint8Array(d);
    return Buffer.from(tx.serialize()).toString("base64");
  }
  // no usable budget ixs — rebuild via decompile with our own probe-sim budget
  const { instructions, alts } = await decompileTx(tx);
  const rebuilt = await finalizeTx(rpc(), instructions, alts);
  return rebuilt.txB64;
}

/** Decompile a (possibly v0+ALT) tx into instructions + lookup tables for rebuilding. */
async function decompileTx(tx: VersionedTransaction): Promise<{
  instructions: TransactionInstruction[];
  alts: AddressLookupTableAccount[];
}> {
  const connection = rpc();
  const msg: any = tx.message;
  const alts: AddressLookupTableAccount[] = [];
  for (const l of msg.addressTableLookups ?? []) {
    const addr = l.accountKey?.toBase58?.() ?? l.accountKey;
    const res = await connection.getAddressLookupTable(new PublicKey(addr));
    if (!res.value) throw new Error(`address lookup table ${addr} not found`);
    alts.push(res.value);
  }
  const decompiled = TransactionMessage.decompile(msg, { addressLookupTableAccounts: alts });
  return { instructions: decompiled.instructions, alts };
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
  // price=1 placeholder — rewritten to the fixed 1-lamport fee after build
  let res = await post({ computeUnitPriceMicroLamports: 1 });
  let b64: string | undefined;
  if (res.ok) {
    b64 = ((await res.json()) as any)?.swapTransaction;
  }
  if (!b64) {
    // fallback: Jupiter's capped medium priority level
    res = await post({
      prioritizationFeeLamports: { priorityLevelWithMaxLamports: { priorityLevel: "medium", maxLamports: 1 } },
    });
    if (!res.ok) throw new Error(`jup swap → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    b64 = ((await res.json()) as any)?.swapTransaction;
    if (!b64) throw new Error("jup swap: no swapTransaction");
    return { txB64: b64, size: Buffer.from(b64, "base64").length, quote };
  }
  const txB64 = await rewriteSwapPriority(b64);
  return { txB64, size: Buffer.from(txB64, "base64").length, quote };
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

  // KTX txs carry SetComputeUnitLimit 1M and NO price → zero priority fee, never
  // lands. Decompile, strip ComputeBudget ixs, rebuild with our probe-sim budget.
  const connection = rpc();
  const tx = deserializeTx(b64);
  const { instructions, alts } = await decompileTx(tx);
  const ixs = instructions.filter(ix => ix.programId.toBase58() !== CB_PROGRAM);
  if (!ixs.length) throw new Error(`kamino ${action}: no instructions after stripping compute budget`);
  const built = await finalizeTx(connection, ixs, alts);
  if (built.size > MAX_TX_BYTES) throw new Error(`kamino ${action}: tx too large (${built.size} B)`);
  return { txB64: built.txB64, size: built.size };
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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Poll a signature for up to ~40 s, rebroadcasting the raw tx each round and
 * checking blockhash expiry. Never throws on timeout — returns "pending"/"expired".
 */
async function confirmLoop(
  connection: Connection,
  signature: string,
  recentBlockhash: string,
): Promise<{ signature: string; status: string }> {
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    const st = await connection.getSignatureStatuses([signature], { searchTransactionHistory: false });
    const s = st.value[0];
    if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
      return { signature, status: s.err ? `failed: ${JSON.stringify(s.err)}` : s.confirmationStatus };
    }
    if (s?.err) return { signature, status: `failed: ${JSON.stringify(s.err)}` };
    try {
      const valid = await connection.isBlockhashValid(recentBlockhash, { commitment: "processed" });
      if (valid.value === false) {
        // one last status check before declaring expiry
        const st2 = await connection.getSignatureStatuses([signature], { searchTransactionHistory: false });
        const s2 = st2.value[0];
        if (s2?.confirmationStatus === "confirmed" || s2?.confirmationStatus === "finalized") {
          return { signature, status: s2.err ? `failed: ${JSON.stringify(s2.err)}` : s2.confirmationStatus };
        }
        if (s2?.err) return { signature, status: `failed: ${JSON.stringify(s2.err)}` };
        // processed but not yet confirmed — it may still confirm, keep polling
        if (!s2) return { signature, status: "expired" };
      }
    } catch {
      /* RPC hiccup — keep polling */
    }
    await sleep(2000);
  }
  return { signature, status: "pending" };
}

export async function sendTxAndConfirm(txB64: string): Promise<{ signature: string; status: string }> {
  const connection = rpc();
  const tx = deserializeTx(txB64);
  const raw = tx.serialize();
  const signature = txSignature(txB64);
  // sent once; the app never resends — the RPC node forwards it until it lands or expires
  await connection.sendRawTransaction(raw, { skipPreflight: true });
  return confirmLoop(connection, signature, tx.message.recentBlockhash);
}

/** Signature of a signed tx without sending (first signature = txid). */
export function txSignature(txB64: string): string {
  const tx = deserializeTx(txB64);
  const sig = tx.signatures[0];
  if (!sig || sig.every(b => b === 0)) throw new Error("tx has no signature");
  return bs58.encode(sig);
}

/**
 * Re-check a previously sent signed tx (no resend): poll until terminal.
 * Used by the client when `send` returned "pending" or on Resume.
 */
export async function statusTxAndConfirm(txB64: string): Promise<{ signature: string; status: string }> {
  const connection = rpc();
  const tx = deserializeTx(txB64);
  const signature = txSignature(txB64);
  return confirmLoop(connection, signature, tx.message.recentBlockhash);
}
