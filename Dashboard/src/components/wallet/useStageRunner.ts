import { useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { WALLET } from "../../lib/config";
import type { PlanStage, RebalancePlan } from "../../lib/rebalance/plan";
import { api, b64ToBytes, bytesToB64, STAGE_LABEL, type SavedRun, type StageState, type StageStatus } from "./shared";

/**
 * Shared stage runner for wallet-signed flows (rebalance, top-up): plan fetch,
 * localStorage persistence/resume, sequential build → sign → send → confirm.
 * Each build is re-validated server-side against fresh on-chain state.
 */
export function useStageRunner(opts: {
  lsKey: string;
  fetchPlan: () => Promise<RebalancePlan | null>;
  onDone: () => void;
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
  const [busyLabel, setBusyLabel] = useState("");
  const [runStart, setRunStart] = useState<number | null>(null);

  const loadPlan = useCallback(async (): Promise<RebalancePlan | null> => {
    setLoadingPlan(true);
    setPlanErr(null);
    try {
      const p = await fetchRef.current();
      if (!p) {
        setPlan(null);
        setStates([]);
        return null;
      }
      setPlan(p);
      setStates(p.stages.map(() => ({ status: "pending" })));
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
            setStates(saved.states.map(s => (s.status === "confirmed" ? s : { status: "pending" as StageStatus })));
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

  const signAndSend = async (txB64: string) => {
    const tx = VersionedTransaction.deserialize(b64ToBytes(txB64));
    const signed = await signTransaction!(tx);
    const out = await api({ action: "send", tx: bytesToB64(signed.serialize()) });
    return out as { signature: string; status: string };
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
        setBusyLabel(STAGE_LABEL[stage.type]);
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
        for (const t of txs) {
          setStage(i, { status: "awaiting signature" });
          let res: { signature: string; status: string };
          try {
            res = await signAndSend(t.tx);
          } catch (e: any) {
            setStage(i, { status: "failed", error: `signature/send: ${String(e?.message ?? e)}` });
            return;
          }
          if (res.status !== "confirmed" && res.status !== "finalized") {
            setStage(i, { status: "failed", error: `tx ${res.signature}: ${res.status}`, sig: res.signature });
            return;
          }
          lastSig = res.signature;
        }
        setStage(i, { status: "confirmed", sig: lastSig });
      }
      localStorage.removeItem(lsKeyRef.current);
      setRunStart(null);
      doneRef.current();
    } finally {
      setRunning(false);
      setBusyLabel("");
    }
  };

  const execute = async () => {
    if (!plan || !connected || wrongWallet || running || unfinished) return;
    // re-plan right before executing so amounts match current prices
    const fresh = await loadPlan();
    if (fresh && fresh.stages.length > 0 && !fresh.error) await executeWith(fresh);
  };

  // resume = keep the saved plan, rebuild each remaining stage fresh server-side
  const resume = async () => {
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
    busyLabel,
    unfinished,
    wrongWallet,
    connected,
    canSign: !!signTransaction,
    loadPlan,
    execute,
    resume,
    discard,
  };
}
