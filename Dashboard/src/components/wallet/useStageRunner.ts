import { useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { WALLET } from "../../lib/config";
import type { PlanStage, RebalancePlan } from "../../lib/rebalance/plan";
import {
  api,
  b64ToBytes,
  bytesToB64,
  type SavedRun,
  type SignReadyState,
  type StageState,
  type StageStatus,
} from "./shared";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface TxResult {
  signature: string;
  status: string;
  feeLamports?: number;
}

const isConfirmed = (s: string) => s === "confirmed" || s === "finalized";

/** Transient user activation survives ~5 s — sign calls must happen within it. */
const ACTIVATION_MS = 3_000;

interface SignRequest {
  tx: VersionedTransaction;
  stageIndex: number;
  resolve: (signed: VersionedTransaction | PromiseLike<VersionedTransaction>) => void;
  reject: (e: unknown) => void;
}

/**
 * Shared stage runner for wallet-signed flows (rebalance, top-up): plan fetch,
 * localStorage persistence/resume, sequential build → sign → send → confirm.
 * Each build is re-validated server-side against fresh on-chain state.
 *
 * A sent-but-unconfirmed tx is persisted (pendingTx) so a Resume first checks its
 * signature via `status` instead of blindly rebuilding — a tx that actually
 * landed is never executed twice.
 */
export function useStageRunner(opts: {
  lsKey: string;
  fetchPlan: () => Promise<RebalancePlan | null>;
  /** total network fees paid by the run (lamports), or null if unknown */
  onDone: (totalLamports: number | null) => void;
}) {
  const { connected, publicKey, signTransaction } = useWallet();
  const fetchRef = useRef(opts.fetchPlan);
  const doneRef = useRef(opts.onDone);
  const lsKeyRef = useRef(opts.lsKey);
  useEffect(() => {
    fetchRef.current = opts.fetchPlan;
    doneRef.current = opts.onDone;
    lsKeyRef.current = opts.lsKey;
  });

  const [plan, setPlan] = useState<RebalancePlan | null>(null);
  const [planErr, setPlanErr] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [states, setStates] = useState<StageState[]>([]);
  const [running, setRunning] = useState(false);
  const [runStart, setRunStart] = useState<number | null>(null);
  const [signReady, setSignReady] = useState<SignReadyState | null>(null);
  const signReqRef = useRef<SignRequest | null>(null);
  const lastTapAt = useRef(0);
  // per-stage fee totals — ref mirror so the run total is readable synchronously
  const feesRef = useRef<number[]>([]);

  const loadPlan = useCallback(async (): Promise<RebalancePlan | null> => {
    setLoadingPlan(true);
    setPlanErr(null);
    try {
      const p = await fetchRef.current();
      if (!p) {
        setPlan(null);
        setStates([]);
        feesRef.current = [];
        return null;
      }
      setPlan(p);
      setStates(p.stages.map(() => ({ status: "pending" })));
      feesRef.current = [];
      if (p.error) setPlanErr(p.error);
      return p;
    } catch (e: any) {
      setPlan(null);
      setPlanErr(String(e?.message ?? e));
      return null;
    } finally {
      setLoadingPlan(false);
    }
  }, []);

  // restore an unfinished saved run, else fetch a fresh plan
  useEffect(() => {
    const t = setTimeout(() => {
      const raw = localStorage.getItem(lsKeyRef.current);
      if (raw) {
        try {
          const saved = JSON.parse(raw) as SavedRun;
          const unfinished =
            saved?.plan?.stages?.length > 0 &&
            Array.isArray(saved.states) &&
            saved.states.some(s => s.status !== "confirmed");
          if (unfinished) {
            setPlan(saved.plan);
            // confirmed stages stay confirmed; everything else retries fresh —
            // but keep pendingTx so Resume can check whether it already landed
            setStates(
              saved.states.map(s =>
                s.status === "confirmed"
                  ? s
                  : {
                      status: "pending" as StageStatus,
                      pendingTx: s.pendingTx,
                      pendingIdx: s.pendingIdx,
                      pendingCount: s.pendingCount,
                      feeLamports: s.feeLamports,
                    },
              ),
            );
            feesRef.current = saved.states.map(s => s.feeLamports ?? 0);
            setRunStart(saved.startedAt ?? Date.now());
            return;
          }
        } catch {
          /* corrupted entry — fall through to fresh plan */
        }
        localStorage.removeItem(lsKeyRef.current);
      }
      void loadPlan();
    }, 0);
    return () => clearTimeout(t);
  }, [loadPlan]);

  const setStage = (i: number, s: Partial<StageState>) =>
    setStates(prev => prev.map((x, j) => (j === i ? { ...x, ...s } : x)));

  /** Accumulate a landed tx's network fee onto its stage (state + ref mirror). */
  const addStageFee = (i: number, fee?: number) => {
    if (typeof fee !== "number" || !Number.isFinite(fee) || fee <= 0) return;
    feesRef.current[i] = (feesRef.current[i] ?? 0) + fee;
    setStates(prev => prev.map((x, j) => (j === i ? { ...x, feeLamports: (x.feeLamports ?? 0) + fee } : x)));
  };

  // persist the run after each stage update; clear once everything is confirmed
  useEffect(() => {
    if (!plan || runStart == null) return;
    if (plan.stages.length > 0 && states.some(s => s.status !== "confirmed")) {
      try {
        localStorage.setItem(
          lsKeyRef.current,
          JSON.stringify({ plan, states, startedAt: runStart } satisfies SavedRun),
        );
      } catch {
        /* storage full/blocked — run continues in memory */
      }
    } else {
      localStorage.removeItem(lsKeyRef.current);
    }
  }, [plan, states, runStart]);

  const unfinished = runStart != null && states.some(s => s.status !== "confirmed");
  const wrongWallet = connected && publicKey && publicKey.toBase58() !== WALLET;

  /** Poll `status` until the tx reaches a terminal state (never returns "pending"). */
  const awaitTerminal = async (signedB64: string): Promise<TxResult> => {
    for (;;) {
      const res = (await api({ action: "status", tx: signedB64 })) as TxResult;
      if (res.status !== "pending") return res;
      await sleep(2000);
    }
  };

  /**
   * Check a persisted pending tx before rebuilding its stage.
   * Returns "confirmed" (stage done) or "rebuild" (safe to rebuild the stage).
   */
  const resolvePending = async (i: number): Promise<"confirmed" | "rebuild"> => {
    const st = states[i];
    if (!st?.pendingTx) return "rebuild";
    setStage(i, { status: "confirming", error: undefined });
    const res = await awaitTerminal(st.pendingTx);
    addStageFee(i, res.feeLamports);
    if (isConfirmed(res.status)) {
      const last = (st.pendingIdx ?? 0) === (st.pendingCount ?? 1) - 1;
      if (last) {
        setStage(i, { status: "confirmed", sig: res.signature, pendingTx: undefined });
        return "confirmed";
      }
      // an earlier tx of a split stage confirmed — rebuild the stage; the server
      // re-validates against fresh state so completed work isn't repeated
    }
    setStage(i, { status: "pending", pendingTx: undefined, sig: undefined, error: undefined });
    return "rebuild";
  };

  /**
   * Sign a built tx, send it, and poll to a terminal state.
   * The MWA hand-off needs transient user activation (~5 s): if the build took
   * longer than that since the last tap, wait for an explicit Sign tap instead
   * of calling signTransaction into an expired activation.
   */
  const signSendConfirm = async (
    i: number,
    j: number,
    count: number,
    txB64: string,
  ): Promise<{ ok: true; sig: string } | { ok: false; error: string; sig?: string }> => {
    const tx = VersionedTransaction.deserialize(b64ToBytes(txB64));
    let signed: VersionedTransaction;
    if (!signTransaction || Date.now() - lastTapAt.current < ACTIVATION_MS) {
      // fresh activation (or no signer → fails fast upstream) — sign right away
      setStage(i, { status: "awaiting signature", error: undefined });
      signed = await signTransaction!(tx);
    } else {
      setStage(i, { status: "ready to sign", error: undefined });
      setSignReady({ stageIndex: i, txIndex: j, txCount: count });
      try {
        signed = await new Promise<VersionedTransaction>((resolve, reject) => {
          signReqRef.current = { tx, stageIndex: i, resolve, reject };
        });
      } finally {
        signReqRef.current = null;
        setSignReady(null);
      }
    }
    const signedB64 = bytesToB64(signed.serialize());
    // persist the signed tx so a crash/resume can check it via `status`
    setStage(i, { status: "sending", pendingTx: signedB64, pendingIdx: j, pendingCount: count });
    let res: TxResult;
    try {
      res = (await api({ action: "send", tx: signedB64 })) as TxResult;
    } catch (e: any) {
      return { ok: false, error: `send: ${String(e?.message ?? e)}` };
    }
    if (res.status === "pending") {
      setStage(i, { status: "confirming" });
      try {
        res = await awaitTerminal(signedB64);
      } catch (e: any) {
        return { ok: false, error: `confirm: ${String(e?.message ?? e)}` };
      }
    }
    addStageFee(i, res.feeLamports);
    if (!isConfirmed(res.status)) {
      // terminal but not confirmed — the tx can never land now, so drop pendingTx:
      // Resume rebuilds directly instead of re-checking (and re-counting) it
      setStage(i, { pendingTx: undefined });
      const msg =
        res.status === "expired"
          ? "Transaction expired without landing — nothing was debited. Tap Resume to rebuild it."
          : `tx ${res.signature}: ${res.status}`;
      return { ok: false, error: msg, sig: res.signature };
    }
    setStage(i, { status: "sending", pendingTx: undefined });
    return { ok: true, sig: res.signature };
  };

  const executeWith = async (p: RebalancePlan) => {
    if (!connected || wrongWallet || running) return;
    setRunning(true);
    setRunStart(prev => prev ?? Date.now());
    try {
      // continue from the first non-confirmed stage — each build is re-validated
      // against fresh server-side state, so resumed amounts are never stale
      const indices = p.stages.map((_, i) => i).filter(i => states[i]?.status !== "confirmed");
      for (const i of indices) {
        const stage: PlanStage = p.stages[i];
        // a previously sent tx may have landed — check before rebuilding
        let resolved: "confirmed" | "rebuild";
        try {
          resolved = await resolvePending(i);
        } catch (e: any) {
          setStage(i, { status: "failed", error: `status check: ${String(e?.message ?? e)}` });
          return;
        }
        if (resolved === "confirmed") continue;

        setStage(i, { status: "building", error: undefined });
        let built: any;
        try {
          built = await api({ action: "build", stage });
        } catch (e: any) {
          setStage(i, { status: "failed", error: String(e?.message ?? e) });
          return;
        }
        const txs: { tx: string; size: number; split?: boolean; quote?: unknown; simulation: any }[] = built?.txs ?? [];
        if (!txs.length || txs.some(t => typeof t?.tx !== "string")) {
          setStage(i, { status: "failed", error: "server returned no transaction" });
          return;
        }
        let lastSig = "";
        for (let j = 0; j < txs.length; j++) {
          let r: Awaited<ReturnType<typeof signSendConfirm>>;
          try {
            r = await signSendConfirm(i, j, txs.length, txs[j].tx);
          } catch (e: any) {
            // wallet signature rejected/cancelled
            setStage(i, { status: "failed", error: `signature: ${String(e?.message ?? e)}` });
            return;
          }
          if (!r.ok) {
            setStage(i, { status: "failed", error: r.error, sig: r.sig });
            return;
          }
          lastSig = r.sig;
        }
        setStage(i, { status: "confirmed", sig: lastSig, pendingTx: undefined });
      }
      const totalFees = feesRef.current.reduce((s, f) => s + (f ?? 0), 0);
      localStorage.removeItem(lsKeyRef.current);
      setRunStart(null);
      doneRef.current(totalFees > 0 ? totalFees : null);
    } finally {
      setRunning(false);
    }
  };

  /**
   * Tap handler for the "ready to sign" state — MUST call signTransaction
   * synchronously (no awaits) so the MWA navigation still has user activation.
   */
  const signNow = () => {
    const req = signReqRef.current;
    if (!req || !signTransaction) return;
    lastTapAt.current = Date.now();
    signReqRef.current = null;
    setSignReady(null);
    setStage(req.stageIndex, { status: "awaiting signature", error: undefined });
    try {
      req.resolve(signTransaction(req.tx));
    } catch (e) {
      req.reject(e);
    }
  };

  const execute = async () => {
    lastTapAt.current = Date.now();
    if (!plan || !connected || wrongWallet || running || unfinished) return;
    // re-plan right before executing so amounts match current prices
    const fresh = await loadPlan();
    if (fresh && fresh.stages.length > 0 && !fresh.error) await executeWith(fresh);
  };

  // resume = keep the saved plan, rebuild each remaining stage fresh server-side
  const resume = async () => {
    lastTapAt.current = Date.now();
    if (!plan || running) return;
    await executeWith(plan);
  };

  const discard = () => {
    localStorage.removeItem(lsKeyRef.current);
    setRunStart(null);
    setStates([]);
    void loadPlan();
  };

  return {
    plan,
    planErr,
    loadingPlan,
    states,
    running,
    unfinished,
    wrongWallet,
    connected,
    canSign: !!signTransaction,
    loadPlan,
    execute,
    resume,
    discard,
    signReady,
    signNow,
  };
}
