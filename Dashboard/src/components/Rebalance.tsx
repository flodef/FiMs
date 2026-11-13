import { IconRefresh } from "@tabler/icons-react";
import { fmtPct } from "../lib/format";
import type { PlanStage } from "../lib/rebalance/plan";
import { Card, CardTitle } from "./ui";
import { RunActions, StageList } from "./plan-ui";
import { api } from "./wallet/shared";
import { FeeEstimateLine, WalletCard, WalletShell } from "./wallet/WalletShell";
import { useStageRunner } from "./wallet/useStageRunner";

const LS_KEY = "fims-rebalance";

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
  if (s.type === "spend-transfer") return `send ≈ ${s.usdt.toFixed(2)} USDT`;
  return `≈ ${(s.estUsdg ?? s.amountUsdg).toFixed(2)} USDG`;
};

function Inner({ onDone }: { onDone: () => void }) {
  const r = useStageRunner({ lsKey: LS_KEY, fetchPlan: () => api({ action: "plan" }), onDone });
  const { plan, states, unfinished } = r;

  const walletReady = r.connected && !r.wrongWallet && r.canSign;
  const canExecute = !r.running && walletReady && !!plan && plan.stages.length > 0 && !plan.error && !unfinished;

  return (
    <div className="space-y-3">
      <WalletCard />

      {/* plan card */}
      <Card>
        <CardTitle
          right={
            <button
              onClick={() => void r.loadPlan()}
              disabled={r.loadingPlan || unfinished}
              className="rounded-lg p-1 text-muted hover:bg-card2 disabled:opacity-50"
              aria-label="Refresh plan"
              title={unfinished ? "Discard the saved run to refresh the plan" : "Refresh plan"}
            >
              <IconRefresh size={14} className={r.loadingPlan ? "animate-spin" : ""} />
            </button>
          }
        >
          Plan
        </CardTitle>
        {r.loadingPlan && !plan && <p className="text-xs text-muted">Fetching live positions…</p>}
        {r.planErr && <p className="text-xs text-danger">{r.planErr}</p>}
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
        {plan && plan.stages.length > 0 && <StageList stages={plan.stages} states={states} detail={stageDetail} />}
        <FeeEstimateLine fee={plan?.feeEstimate} />
      </Card>

      <RunActions
        running={r.running}
        busyLabel={r.busyLabel}
        unfinished={unfinished}
        walletReady={walletReady}
        canExecute={canExecute}
        onExecute={() => void r.execute()}
        onResume={() => void r.resume()}
        onDiscard={r.discard}
      />
    </div>
  );
}

export default function Rebalance({ onDone }: { onDone: () => void }) {
  return (
    <WalletShell>
      <Inner onDone={onDone} />
    </WalletShell>
  );
}
