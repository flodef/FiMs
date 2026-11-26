import { IconRefresh, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { SPEND_CARDS, type SpendCard } from "../lib/config";
import { fmtPct } from "../lib/format";
import { slippageBps } from "../lib/slippage";
import type { PlanStage } from "../lib/rebalance/plan";
import { Card, CardTitle } from "./ui";
import { PlanInfo, RunActions, StageList } from "./plan-ui";
import { api, short } from "./wallet/shared";
import { WalletShell } from "./wallet/WalletShell";
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
  if (s.type === "spend-transfer") {
    const card = SPEND_CARDS[s.card ?? "jupiter"];
    return `send ≈ ${s.usdt.toFixed(2)} USDT to ${card.label} ${short(card.address)}`;
  }
  if (s.type === "lend-collateral") return `−${Math.abs(s.amount).toFixed(2)} JLP collateral`;
  if (s.type === "swap-any") {
    const inAmt = (s.estIn ?? s.amount).toFixed(2);
    return s.estOut != null ? `≈ ${inAmt} JLP → ≈ ${s.estOut.toFixed(2)} USDT` : `≈ ${inAmt} JLP → USDT`;
  }
  return "";
};

type TopupSource = "kamino" | "lend";
const TOPUP_SOURCE_LABEL: Record<TopupSource, string> = {
  kamino: "from Kamino USD",
  lend: "from Lend JLP",
};
const SPEND_CARD_IDS = Object.keys(SPEND_CARDS) as SpendCard[];

function Inner({
  eurToUsd,
  onDone,
  onOpenSettings,
}: {
  eurToUsd: number;
  onDone: (totalLamports: number | null) => void;
  onOpenSettings: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<TopupSource>("kamino");
  const [card, setCard] = useState<SpendCard>("jupiter");
  const [cardBalances, setCardBalances] = useState<{ jupiter: number | null; nexo: number | null } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    api({ action: "card-balances" })
      .then(setCardBalances)
      .catch(() => {});
  }, []);

  const eur = amount === "" ? NaN : Number(amount);
  const usdt = Number.isFinite(eur) && eurToUsd > 0 ? eur * eurToUsd : NaN;
  const usdtRef = useRef(usdt);
  const sourceRef = useRef(source);
  const cardRef = useRef(card);
  useEffect(() => {
    usdtRef.current = usdt;
    sourceRef.current = source;
    cardRef.current = card;
  }, [usdt, source, card]);

  const r = useStageRunner({
    lsKey: LS_KEY,
    fetchPlan: async () => {
      const u = usdtRef.current;
      if (!Number.isFinite(u) || u < 1) return null;
      return api({
        action: "topup-plan",
        usdt: u,
        source: sourceRef.current,
        card: cardRef.current,
        slippageBps: slippageBps(),
      });
    },
    onDone,
  });
  const { plan, states, unfinished, loadPlan } = r;

  // re-plan (debounced) when the amount/source changes — skipped while a run is unfinished
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
  }, [usdtKey, source, card, unfinished, loadPlan]);

  const walletReady = r.connected && !r.wrongWallet && r.canSign;
  const walletMissing = !r.connected || !!r.wrongWallet;
  const amountOk = Number.isFinite(usdt) && usdt >= 1;
  const canExecute =
    !r.running && walletReady && !!plan && plan.stages.length > 0 && !plan.error && !unfinished && amountOk;

  return (
    <div className="space-y-3">
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
        <div className="mt-2 flex rounded-lg border border-line p-0.5 w-fit" role="group" aria-label="Source">
          {(["kamino", "lend"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                source === s ? "bg-accent text-white" : "text-muted hover:text-ink"
              }`}
            >
              {TOPUP_SOURCE_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex rounded-lg border border-line p-0.5 w-fit" role="group" aria-label="Card">
          {SPEND_CARD_IDS.map(c => (
            <button
              key={c}
              onClick={() => setCard(c)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                card === c ? "bg-accent text-white" : "text-muted hover:text-ink"
              }`}
            >
              {SPEND_CARDS[c].label}
            </button>
          ))}
        </div>
        {cardBalances?.jupiter != null && (
          <p className="mt-1 text-[11px] text-muted">Jupiter card balance ≈ {cardBalances.jupiter.toFixed(2)} USDC</p>
        )}
        {Number.isFinite(usdt) && usdt >= 1 && usdt > 10_000 && (
          <p className="mt-1 text-[11px] text-danger">Max 10,000 USDT per top-up</p>
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
        {r.loadingPlan && !plan && amountOk && <p className="text-xs text-muted">Checking Kamino balance…</p>}
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
            {plan.positions
              .filter(p => p.ltvAfter > p.target)
              .map(p => (
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

export default function Topup({
  eurToUsd,
  onDone,
  onOpenSettings,
}: {
  eurToUsd: number;
  onDone: (totalLamports: number | null) => void;
  onOpenSettings: () => void;
}) {
  return (
    <WalletShell>
      <Inner eurToUsd={eurToUsd} onDone={onDone} onOpenSettings={onOpenSettings} />
    </WalletShell>
  );
}
