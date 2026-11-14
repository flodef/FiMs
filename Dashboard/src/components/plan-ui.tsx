import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconLink,
  IconLoader2,
  IconSignature,
} from "@tabler/icons-react";
import { fmtSOL } from "../lib/format";
import type { PlanStage } from "../lib/rebalance/plan";
import { STAGE_LABEL, type SignReadyState, type StageState, type StageStatus } from "./wallet/shared";

export function RunActions({
  running,
  unfinished,
  walletReady,
  canExecute,
  signReady,
  onSign,
  onExecute,
  onResume,
  onDiscard,
}: {
  running: boolean;
  unfinished: boolean;
  /** connected + right wallet + can sign */
  walletReady: boolean;
  canExecute: boolean;
  /** a built tx is waiting for a wallet signature tap */
  signReady: SignReadyState | null;
  onSign: () => void;
  onExecute: () => void;
  onResume: () => void;
  onDiscard: () => void;
}) {
  return (
    <>
      {signReady ? (
        <button
          onClick={onSign}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-bold text-white"
        >
          <IconSignature size={16} /> Sign step {signReady.stageIndex + 1} in wallet
        </button>
      ) : (
        <>
          {unfinished && !running && (
            <div className="flex gap-2">
              <button
                onClick={onResume}
                disabled={!walletReady}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                Resume
              </button>
              <button
                onClick={onDiscard}
                className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:bg-card2"
              >
                Discard
              </button>
            </div>
          )}
          {!unfinished && (
            <button
              onClick={onExecute}
              disabled={!canExecute}
              className="w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              Execute
            </button>
          )}
        </>
      )}
      <p className="text-center text-[10px] text-muted">
        Transactions are built and simulated server-side; your wallet signs each one. Nothing is sent without your
        approval.
      </p>
    </>
  );
}

const statusIcon = (st: StageStatus) => {
  switch (st) {
    case "confirmed":
      return <IconCircleCheck size={14} className="text-ok" />;
    case "failed":
      return <IconAlertTriangle size={14} className="text-danger" />;
    case "ready to sign":
      return <IconSignature size={14} className="text-accent" />;
    case "building":
    case "awaiting signature":
    case "sending":
    case "confirming":
      return <IconLoader2 size={14} className="animate-spin text-accent" />;
    default:
      return <IconClock size={14} className="text-muted" />;
  }
};

export function StageList({
  stages,
  states,
  detail,
}: {
  stages: PlanStage[];
  states: StageState[];
  detail: (s: PlanStage) => string;
}) {
  const fees = states.reduce((s, x) => s + (x.feeLamports ?? 0), 0);
  return (
    <>
      <ol className="mt-3 space-y-1.5">
        {stages.map((s, i) => {
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
                <div className="truncate text-muted">{detail(s)}</div>
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
      {fees > 0 && <p className="mt-2 text-[11px] text-muted">Network fees paid: {fmtSOL(fees)} SOL</p>}
    </>
  );
}
