import { IconRefresh, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { SPEND_ADDRESS } from "../lib/config";
import { fmtNum } from "../lib/format";
import type { PlanStage } from "../lib/rebalance/plan";
import { Card, CardTitle } from "./ui";
import { RunActions, StageList } from "./plan-ui";
import { api, short } from "./wallet/shared";
import { FeeEstimateLine, WalletCard, WalletShell } from "./wallet/WalletShell";
import { useStageRunner } from "./wallet/useStageRunner";

const LS_KEY = "fims-topup";

const sanitize = (v: string) => {
  const cleaned = v.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  if (!/\d/.test(cleaned)) return "";
  const [intPart, ...fracParts] = cleaned.split(".");
  const int = intPart.replace(/^0+(?=\d)/, "").slice(0, 6) || "0";
  if (!cleaned.includes(".")) return int;
  return `${int}.${fracParts.join("").slice(0, 2)}`;
};

const stageDetail = (s: PlanStage) => {
  if (s.type === "kamino-withdraw") return `≈ ${s.amountUsdg.toFixed(2)} USDG from Kamino`;
  if (s.type === "swap") {
    const inAmt = (s.estIn ?? s.amount).toFixed(2);
    return s.estOut != null ? `≈ ${inAmt} USDG → ≈ ${s.estOut.toFixed(2)} USDT` : `≈ ${inAmt} USDG → USDT`;
  }
  if (s.type === "spend-transfer") return `send ≈ ${s.usdt.toFixed(2)} USDT to ${short(SPEND_ADDRESS)}`;
  return "";
};

function Inner({ eurToUsd, onDone }: { eurToUsd: number; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const eur = amount === "" ? NaN : Number(amount);
  const usdt = Number.isFinite(eur) && eurToUsd > 0 ? eur * eurToUsd : NaN;
  const usdtRef = useRef(usdt);
  useEffect(() => {
    usdtRef.current = usdt;
  }, [usdt]);

  const r = useStageRunner({
    lsKey: LS_KEY,
    fetchPlan: async () => {
      const u = usdtRef.current;
      if (!Number.isFinite(u) || u < 1) return null;
      return api({ action: "topup-plan", usdt: u });
    },
    onDone,
  });
  const { plan, states, unfinished, loadPlan } = r;

  // re-plan (debounced) when the amount changes — skipped while a run is unfinished
  const usdtKey = Number.isFinite(usdt) ? Math.round(usdt * 100) / 100 : usdt;
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (unfinished) return;
    const t = setTimeout(() => void loadPlan(), 400);
    return () => clearTimeout(t);
  }, [usdtKey, unfinished, loadPlan]);

  const walletReady = r.connected && !r.wrongWallet && r.canSign;
  const amountOk = Number.isFinite(usdt) && usdt >= 1;
  const canExecute =
    !r.running && walletReady && !!plan && plan.stages.length > 0 && !plan.error && !unfinished && amountOk;

  return (
    <div className="space-y-3">
      <WalletCard />

      {/* amount card */}
      <Card>
        <CardTitle>Amount (EUR)</CardTitle>
        <div className="relative w-[160px]">
          <input
            ref={inputRef}
            inputMode="decimal"
            pattern="[0-9.,]*"
            value={amount}
            onChange={e => setAmount(sanitize(e.target.value))}
            placeholder="0.00"
            aria-label="Amount in EUR"
            className="w-full rounded-lg border border-line bg-card2 py-2.5 pl-3 pr-7 text-base font-semibold tabular-nums outline-none focus:border-accent"
          />
          {amount !== "" && (
            <button
              type="button"
              aria-label="Clear"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                setAmount("");
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            >
              <IconX size={14} />
            </button>
          )}
        </div>
        {amountOk && (
          <p className="mt-2 text-xs text-muted">
            ≈ {fmtNum(usdt, 2)} USDT · ≈ {fmtNum(usdt, 2)} USDG from Kamino → {short(SPEND_ADDRESS)}
          </p>
        )}
        {Number.isFinite(usdt) && usdt >= 1 && usdt > 10_000 && (
          <p className="mt-1 text-[11px] text-danger">Max 10,000 USDT per top-up</p>
        )}
      </Card>

      {/* plan card */}
      <Card>
        <CardTitle
          right={
            <button
              onClick={() => void loadPlan()}
              disabled={r.loadingPlan || unfinished || !amountOk}
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
        {r.loadingPlan && !plan && amountOk && <p className="text-xs text-muted">Checking Kamino balance…</p>}
        {!amountOk && !plan && <p className="text-xs text-muted">Enter an amount to build the plan.</p>}
        {r.planErr && <p className="text-xs text-danger">{r.planErr}</p>}
        {plan && plan.stages.length === 0 && !plan.error && amountOk && (
          <p className="mt-2 text-xs text-muted">Nothing to do</p>
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

export default function Topup({ eurToUsd, onDone }: { eurToUsd: number; onDone: () => void }) {
  return (
    <WalletShell>
      <Inner eurToUsd={eurToUsd} onDone={onDone} />
    </WalletShell>
  );
}
