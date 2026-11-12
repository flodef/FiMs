import { WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { useStandardWalletAdapters } from "@solana/wallet-standard-wallet-adapter-react";
import { registerMwa } from "@solana-mobile/wallet-standard-mobile";
import { VersionedTransaction } from "@solana/web3.js";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconLink,
  IconLoader2,
  IconPlugConnected,
  IconRefresh,
  IconWallet,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { WALLET } from "../lib/config";
import { fmtPct } from "../lib/format";
import type { PlanStage, RebalancePlan } from "../lib/rebalance/plan";
import { Card, CardTitle } from "./ui";

registerMwa({
  appIdentity: { name: "FiMs Dashboard", uri: "https://dashboard.fims.fi", icon: "/icons/icon-192.png" },
  chains: ["solana:mainnet"],
});

const STAGE_LABEL: Record<PlanStage["type"], string> = {
  lend: "Jupiter Lend",
  "kamino-withdraw": "Kamino withdraw",
  swap: "Swap",
  "kamino-deposit": "Kamino deposit",
};

type StageStatus = "pending" | "building" | "simulated" | "awaiting signature" | "sending" | "confirmed" | "failed";

interface StageState {
  status: StageStatus;
  sig?: string;
  error?: string;
}

const b64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const bytesToB64 = (bytes: Uint8Array): string => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

const api = async (body: Record<string, unknown>) => {
  const res = await fetch("/api/rebalance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
};

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

const LS_KEY = "fims-rebalance";

interface SavedRun {
  plan: RebalancePlan;
  states: StageState[];
  startedAt: number;
}

function Inner({ onDone }: { onDone: () => void }) {
  const { wallets, wallet, publicKey, connected, connecting, select, connect, disconnect, signTransaction } =
    useWallet();
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
      const p: RebalancePlan = await api({ action: "plan" });
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
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        try {
          const saved = JSON.parse(raw) as SavedRun;
          const unfinished =
            saved?.plan?.stages?.length > 0 &&
            Array.isArray(saved.states) &&
            saved.states.some(s => s.status !== "confirmed");
          if (unfinished) {
            // confirmed stages stay confirmed; everything else retries fresh
            setPlan(saved.plan);
            setStates(saved.states.map(s => (s.status === "confirmed" ? s : { status: "pending" as StageStatus })));
            setRunStart(saved.startedAt ?? Date.now());
            return;
          }
        } catch {
          /* corrupted entry — fall through to fresh plan */
        }
        localStorage.removeItem(LS_KEY);
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
        localStorage.setItem(LS_KEY, JSON.stringify({ plan, states, startedAt: runStart } satisfies SavedRun));
      } catch {
        /* storage full/blocked — run continues in memory */
      }
    } else {
      localStorage.removeItem(LS_KEY);
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
      // against a fresh server-side plan, so resumed amounts are never stale
      const indices = p.stages.map((_, i) => i).filter(i => states[i]?.status !== "confirmed");
      for (const i of indices) {
        const stage = p.stages[i];
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
      localStorage.removeItem(LS_KEY);
      setRunStart(null);
      onDone();
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
    localStorage.removeItem(LS_KEY);
    setRunStart(null);
    setStates([]);
    void loadPlan();
  };

  const stageDetail = (s: PlanStage) => {
    if (s.type === "lend")
      return s.ops
        .filter(o => o.deltaUsdt !== 0)
        .map(o => `${o.key} ${o.deltaUsdt > 0 ? "+" : "−"}${Math.abs(o.deltaUsdt).toFixed(2)} USDT`)
        .join(", ");
    if (s.type === "kamino-withdraw") return `≈ ${s.amountUsdg.toFixed(2)} USDG`;
    if (s.type === "swap") {
      const [inU, outU] = s.pair === "usdg-usdt" ? ["USDG", "USDT"] : ["USDT", "USDG"];
      const inAmt = (s.estIn ?? s.amount).toFixed(2);
      return s.estOut != null ? `≈ ${inAmt} ${inU} → ≈ ${s.estOut.toFixed(2)} ${outU}` : `${inAmt} ${inU} → ${outU}`;
    }
    return `≈ ${(s.estUsdg ?? s.amountUsdg).toFixed(2)} USDG`;
  };

  const statusIcon = (st: StageStatus) => {
    switch (st) {
      case "confirmed":
        return <IconCircleCheck size={14} className="text-ok" />;
      case "failed":
        return <IconAlertTriangle size={14} className="text-danger" />;
      case "building":
      case "sending":
        return <IconLoader2 size={14} className="animate-spin text-accent" />;
      case "awaiting signature":
        return <IconWallet size={14} className="text-warn" />;
      default:
        return <IconClock size={14} className="text-muted" />;
    }
  };

  const canExecute =
    !running &&
    connected &&
    !wrongWallet &&
    !!signTransaction &&
    !!plan &&
    plan.stages.length > 0 &&
    !plan.error &&
    !unfinished;

  return (
    <div className="space-y-3">
      {/* wallet row */}
      <Card>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {connected && publicKey ? (
              <>
                <div className="truncate text-sm font-semibold">{short(publicKey.toBase58())}</div>
                <div className="text-[11px] text-muted">{wallet?.adapter.name}</div>
              </>
            ) : (
              <div className="text-sm text-muted">Not connected</div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {connected ? (
              <button
                onClick={() => void disconnect()}
                className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-card2"
              >
                Disconnect
              </button>
            ) : null}
          </div>
        </div>
        {wrongWallet && (
          <p className="mt-2 text-xs font-semibold text-danger">Wrong wallet — connect {short(WALLET)}</p>
        )}
        {!connected && wallets.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-1.5">
            {wallets.map(w => (
              <button
                key={w.adapter.name}
                disabled={connecting}
                onClick={async () => {
                  select(w.adapter.name);
                  try {
                    await connect();
                  } catch {
                    /* user cancelled */
                  }
                }}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm hover:bg-card2 disabled:opacity-50"
              >
                <IconPlugConnected size={16} className="shrink-0 text-accent" />
                <span className="truncate">{w.adapter.name}</span>
              </button>
            ))}
          </div>
        )}
        {!connected && wallets.length === 0 && <p className="mt-2 text-xs text-muted">No Solana wallet detected.</p>}
      </Card>

      {/* plan card */}
      <Card>
        <CardTitle
          right={
            <button
              onClick={() => void loadPlan()}
              disabled={loadingPlan || unfinished}
              className="rounded-lg p-1 text-muted hover:bg-card2 disabled:opacity-50"
              aria-label="Refresh plan"
              title={unfinished ? "Discard the saved run to refresh the plan" : "Refresh plan"}
            >
              <IconRefresh size={14} className={loadingPlan ? "animate-spin" : ""} />
            </button>
          }
        >
          Plan
        </CardTitle>
        {loadingPlan && !plan && <p className="text-xs text-muted">Fetching live positions…</p>}
        {planErr && <p className="text-xs text-danger">{planErr}</p>}
        {plan && plan.positions.length > 0 && (
          <div className="mt-2 space-y-2">
            {plan.positions.map(p => {
              const acted = p.repayUsdt > 0 || p.borrowUsdt > 0;
              const ltvColor = p.ltvAfter > p.target ? "text-warn" : "text-ok";
              return (
                <div key={p.key} className="rounded-lg bg-card2/60 px-3 py-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{p.key}</span>
                    <span className="text-sm">
                      <span className={ltvColor}>{fmtPct(p.ltvBefore)}</span>
                      <span className="text-muted"> → </span>
                      <span className={ltvColor}>{fmtPct(p.ltvAfter)}</span>
                      <span className="text-muted"> / {fmtPct(p.target, 0)}</span>
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px]">
                    {acted ? (
                      p.repayUsdt > 0 ? (
                        <span className="font-semibold text-warn">repay {p.repayUsdt.toFixed(2)} USDT</span>
                      ) : (
                        <span className="font-semibold text-accent">borrow {p.borrowUsdt.toFixed(2)} USDT</span>
                      )
                    ) : (
                      <span className="text-muted">at target</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {plan && plan.stages.length === 0 && !plan.error && (
          <p className="mt-2 text-xs text-muted">Already at target</p>
        )}
        {plan && plan.stages.length > 0 && (
          <ol className="mt-3 space-y-1.5">
            {plan.stages.map((s, i) => {
              const st = states[i] ?? { status: "pending" as StageStatus };
              return (
                <li key={i} className="flex items-start gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs">
                  <span className="mt-0.5 shrink-0">{statusIcon(st.status)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">
                        {i + 1}. {STAGE_LABEL[s.type]}
                      </span>
                      <span className="shrink-0 text-muted">{st.status}</span>
                    </div>
                    <div className="truncate text-muted">{stageDetail(s)}</div>
                    {st.error && <div className="mt-0.5 break-words text-danger">{st.error}</div>}
                    {st.sig && st.status === "confirmed" && (
                      <a
                        href={`https://solscan.io/tx/${st.sig}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 inline-flex items-center gap-1 text-accent"
                      >
                        <IconLink size={11} /> Solscan
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {/* actions */}
      {running && (
        <p className="flex items-center gap-2 text-center text-xs text-muted">
          <IconLoader2 size={14} className="animate-spin" /> {busyLabel}…
        </p>
      )}
      {unfinished && !running && (
        <div className="flex gap-2">
          <button
            onClick={() => void resume()}
            disabled={!connected || wrongWallet || !signTransaction}
            className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            Resume
          </button>
          <button
            onClick={discard}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:bg-card2"
          >
            Discard
          </button>
        </div>
      )}
      {!unfinished && (
        <button
          onClick={() => void execute()}
          disabled={!canExecute}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          Execute
        </button>
      )}
      <p className="text-center text-[10px] text-muted">
        Transactions are built and simulated server-side; your wallet signs each one. Nothing is sent without your
        approval.
      </p>
    </div>
  );
}

export default function Rebalance({ onDone }: { onDone: () => void }) {
  const adapters = useStandardWalletAdapters([]);
  return (
    <WalletProvider wallets={adapters} autoConnect>
      <Inner onDone={onDone} />
    </WalletProvider>
  );
}
