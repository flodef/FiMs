import { IconAlertTriangle, IconCircleCheck, IconClock, IconLink, IconLoader2 } from "@tabler/icons-react";
import type { PlanStage } from "../lib/rebalance/plan";
import { STAGE_LABEL, type StageState, type StageStatus } from "./wallet/shared";

export function RunActions({
  running,
  unfinished,
  walletReady,
  canExecute,
  onExecute,
  onResume,
  onDiscard,
}: {
  running: boolean;
  unfinished: boolean;
  /** connected + right wallet + can sign */
  walletReady: boolean;
  canExecute: boolean;
  onExecute: () => void;
  onResume: () => void;
  onDiscard: () => void;
}) {
  return (
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
  return (
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
  );
}
