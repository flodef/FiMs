import { IconRefresh, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { fmtNum, fmtPct } from "../lib/format";
import { slippageBps } from "../lib/slippage";
import {
  RESTORE_MAX_USD,
  RESTORE_TITLE,
  RESTORE_TOKENS,
  type PlanStage,
  type RestoreDirection,
  type RestoreSource,
  type RestoreTarget,
} from "../lib/rebalance/plan";
import { Card, CardTitle } from "./ui";
import { PlanInfo, RunActions, StageList } from "./plan-ui";
import { api } from "./wallet/shared";
import { WalletShell } from "./wallet/WalletShell";
import { useStageRunner } from "./wallet/useStageRunner";

const LS_KEY = "fims-restore";

const SOURCE_LABEL: Record<RestoreDirection, Record<RestoreSource, string>> = {
  buy: { kamino: "from Kamino USDG", lend: "from Lend JLP" },
  sell: { kamino: "to Kamino USD", lend: "to Lend JLP" },
};

const sanitize = (v: string) => {
  const cleaned = v.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  if (!/\d/.test(cleaned)) return "";
  const [intPart, ...fracParts] = cleaned.split(".");
  const int = intPart.replace(/^0+(?=\d)/, "").slice(0, 7) || "0";
  if (!cleaned.includes(".")) return int;
  return `${int}.${fracParts.join("").slice(0, 4)}`;
};

const stageDetail = (s: PlanStage) => {
  if (s.type === "kamino-withdraw") return `≈ ${s.usdgOut ?? s.amountUsdg} USDG from Kamino`;
  if (s.type === "swap-any") {
    const tin = RESTORE_TOKENS[s.inToken].symbol;
    const tout = RESTORE_TOKENS[s.outToken].symbol;
    const inAmt = (s.estIn ?? s.amount).toFixed(2);
    return s.estOut != null ? `≈ ${inAmt} ${tin} → ≈ ${s.estOut.toFixed(2)} ${tout}` : `≈ ${inAmt} ${tin} → ${tout}`;
  }
  if (s.type === "lend-collateral") {
    const sym = s.key === "JLP" ? "JLP" : "JupSOL";
    return `${s.amount > 0 ? "+" : "−"}${Math.abs(s.amount).toFixed(2)} ${sym} collateral`;
  }
  if (s.type === "earn-deposit") return `${s.amount.toFixed(2)} EURC → Jupiter Earn`;
  if (s.type === "earn-withdraw") return `${s.amount.toFixed(2)} EURC ← Jupiter Earn`;
  if (s.type === "kamino-deposit") return `≈ ${(s.estUsdg ?? s.amountUsdg).toFixed(2)} USDG to Kamino`;
  return "";
};

function Inner({
  target,
  diff,
  walletPart,
  usdDiff,
  priceUsd,
  onDone,
  onOpenSettings,
}: {
  target: RestoreTarget;
  diff: number;
  walletPart: number;
  usdDiff: number;
  priceUsd: number | null;
  onDone: (totalLamports: number | null, direction: RestoreDirection) => void;
  onOpenSettings: () => void;
}) {
  const label = RESTORE_TITLE[target];
  const homeLabel = target === "eurc" ? "earn" : target === "usd" ? "kamino" : "lend";
  const fixedSource: RestoreSource | null = target === "usd" ? "lend" : target === "jlp" ? "kamino" : null;
  // no choice: the sign of the diff decides — surplus sells, shortfall buys
  const direction: RestoreDirection = diff > 0 ? "sell" : "buy";
  const [source, setSource] = useState<RestoreSource>(
    () => fixedSource ?? (direction === "sell" ? "kamino" : usdDiff > 0 ? "kamino" : "lend"),
  );
  // USD-value cap translated into token units (0.5% margin for price drift); no
  // clamp when the price is unknown — the server-side 20k USD cap still applies.
  const maxAmount =
    priceUsd != null && priceUsd > 0 ? Math.floor((RESTORE_MAX_USD / priceUsd) * 0.995 * 100) / 100 : null;
  const [amount, setAmount] = useState(() => {
    const pre = Math.min(Math.max(0, Math.abs(diff)), maxAmount ?? Infinity);
    return pre > 0 ? sanitize(pre.toFixed(2)) : "";
  });
  const clamp = (v: string) => {
    if (v === "" || maxAmount == null) return v;
    const n = Number(v);
    return Number.isFinite(n) && n > maxAmount ? maxAmount.toFixed(2) : v;
  };
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const amt = amount === "" ? NaN : Number(amount);
  const amountOk = Number.isFinite(amt) && amt > 0;
  const amountRef = useRef(amt);
  const sourceRef = useRef(source);
  useEffect(() => {
    amountRef.current = amt;
    sourceRef.current = source;
  }, [amt, source]);

  const r = useStageRunner({
    lsKey: LS_KEY,
    fetchPlan: async () => {
      const a = amountRef.current;
      if (!Number.isFinite(a) || a <= 0) return null;
      return api({
        action: "restore-plan",
        target,
        source: sourceRef.current,
        amount: a,
        direction,
        slippageBps: slippageBps(),
      });
    },
    onDone: l => onDone(l, direction),
  });
  const { plan, states, unfinished, loadPlan } = r;

  // re-plan (debounced) when amount/source/direction changes — skipped while a run is unfinished
  const amtKey = Number.isFinite(amt) ? Math.round(amt * 10000) / 10000 : amt;
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (unfinished) return;
    const t = setTimeout(() => void loadPlan(), 400);
    return () => clearTimeout(t);
  }, [amtKey, source, direction, unfinished, loadPlan]);

  const walletReady = r.connected && !r.wrongWallet && r.canSign;
  const walletMissing = !r.connected || !!r.wrongWallet;
  const canExecute =
    !r.running && walletReady && !!plan && plan.stages.length > 0 && !plan.error && !unfinished && amountOk;

  const overTarget = plan?.positions.filter(p => p.ltvAfter > p.target) ?? [];

  return (
    <div className="space-y-3">
      {/* amount + counter card */}
      <Card>
        <CardTitle>{direction === "sell" ? `Sell ${label}` : `Amount (${label})`}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[140px]">
            <input
              ref={inputRef}
              inputMode="decimal"
              pattern="[0-9.,]*"
              value={amount}
              onChange={e => setAmount(clamp(sanitize(e.target.value)))}
              onBlur={() => setAmount(clamp)}
              placeholder="0.00"
              aria-label={`Amount in ${label}`}
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
          {fixedSource ? (
            <span className="rounded-lg bg-card2 px-3 py-2 text-xs font-medium text-muted">
              {SOURCE_LABEL[direction][fixedSource]}
            </span>
          ) : (
            <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="Source">
              {(["kamino", "lend"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    source === s ? "bg-accent text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  {SOURCE_LABEL[direction][s]}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          {direction === "sell" ? "Surplus" : "Shortfall"}: {diff >= 0 ? "+" : "−"}
          {fmtNum(Math.abs(diff), 2)} {label}
          {Math.abs(walletPart) >= 1e-9 && (
            <>
              {" "}
              ({homeLabel} {diff - walletPart >= 0 ? "+" : "−"}
              {fmtNum(Math.abs(diff - walletPart), 2)} · wallet {walletPart >= 0 ? "+" : "−"}
              {fmtNum(Math.abs(walletPart), 2)})
            </>
          )}
        </p>
        {maxAmount != null && Math.abs(diff) > maxAmount + 1e-9 && (
          <p className="mt-1 text-[11px] text-muted">
            Max ≈ {fmtNum(maxAmount, 0)} {label} ({RESTORE_MAX_USD.toLocaleString("en-US")} USD) per operation
          </p>
        )}
      </Card>

      {/* plan card */}
      <Card>
        <CardTitle
          right={
            <span className="flex items-center gap-0.5">
              <PlanInfo />
              <button
                onClick={() => void loadPlan()}
                disabled={r.loadingPlan || unfinished || !amountOk}
                className="rounded-lg p-1 text-muted hover:bg-card2 disabled:opacity-50"
                aria-label="Refresh plan"
                title={unfinished ? "Discard the saved run to refresh the plan" : "Refresh plan"}
              >
                <IconRefresh size={14} className={r.loadingPlan ? "animate-spin" : ""} />
              </button>
            </span>
          }
        >
          Plan
        </CardTitle>
        {r.loadingPlan && !plan && amountOk && <p className="text-xs text-muted">Checking balances…</p>}
        {!amountOk && !plan && <p className="text-xs text-muted">Enter an amount to build the plan.</p>}
        {r.planErr && <p className="text-xs text-danger">{r.planErr}</p>}
        {plan && plan.stages.length === 0 && !plan.error && amountOk && (
          <p className="mt-2 text-xs text-muted">Nothing to do</p>
        )}
        {plan && plan.positions.length > 0 && (
          <div className="mb-2 space-y-1">
            {plan.positions.map((p, i) => (
              <p key={`${p.key}-${i}`} className="text-xs text-muted">
                {p.key} LTV {fmtPct(p.ltvBefore)} → {fmtPct(p.ltvAfter)}
                {p.ltvAfter > p.target && <span className="text-warn"> (above target)</span>}
              </p>
            ))}
            {overTarget.map(p => (
              <p key={`warn-${p.key}`} className="text-[11px] text-warn">
                {p.key} LTV will be above target — run Rebalance afterwards
              </p>
            ))}
          </div>
        )}
        {plan && plan.stages.length > 0 && <StageList stages={plan.stages} states={states} detail={stageDetail} />}
      </Card>

      <RunActions
        running={r.running}
        unfinished={unfinished}
        walletReady={walletReady}
        walletMissing={walletMissing}
        connecting={r.connecting}
        canExecute={canExecute}
        signReady={r.signReady}
        awaitingSignature={states.some(s => s.status === "awaiting signature")}
        onSign={r.signNow}
        onCancel={r.cancelSign}
        onExecute={() => void r.execute()}
        onResume={() => void r.resume()}
        onDiscard={r.discard}
        onOpenSettings={onOpenSettings}
      />
    </div>
  );
}

export default function Restore({
  target,
  diff,
  walletPart,
  usdDiff,
  priceUsd,
  onDone,
  onOpenSettings,
}: {
  target: RestoreTarget;
  diff: number;
  walletPart: number;
  usdDiff: number;
  priceUsd: number | null;
  onDone: (totalLamports: number | null, direction: RestoreDirection) => void;
  onOpenSettings: () => void;
}) {
  return (
    <WalletShell>
      <Inner
        target={target}
        diff={diff}
        walletPart={walletPart}
        usdDiff={usdDiff}
        priceUsd={priceUsd}
        onDone={onDone}
        onOpenSettings={onOpenSettings}
      />
    </WalletShell>
  );
}
