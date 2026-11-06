import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import type { CollateralAlert, DashboardResult, ExtraComputation } from "../lib/compute";
import { fixtureMode } from "../lib/fixture";
import { fmtEUR, fmtNum, fmtPct } from "../lib/format";
import type { PositionRow as Row } from "../lib/types";
import { Card, CardTitle, KV, LtvGauge } from "./ui";

const firstWord = (t: string) => t.trim().split(/\s+/)[0] ?? t;
const lastWord = (t: string) => t.trim().split(/\s+/).pop() ?? t;
const shortAddr = (w?: string) => (w && w.length > 12 ? `${w.slice(0, 4)}…${w.slice(-4)}` : (w ?? ""));

interface Bundle<T extends Row> {
  col: T;
  debts: T[];
}

function borrowBundles<T extends Row>(rows: T[]): { bundles: Bundle<T>[]; leftover: T[] } {
  const isDebtOf = (p: Row, col: string) =>
    p.token !== col && /\s/.test(p.token.trim()) && lastWord(p.token).toLowerCase() === col.toLowerCase();
  const cols = rows.filter(p => p.ltv != null || rows.some(d => isDebtOf(d, p.token)));
  const bundles = cols.map(col => ({ col, debts: rows.filter(d => isDebtOf(d, col.token)) }));
  const inBundle = new Set<Row>(bundles.flatMap(b => [b.col, ...b.debts]));
  return { bundles, leftover: rows.filter(p => !inBundle.has(p)) };
}

function PosLine({ p }: { p: Row }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm font-medium">{p.token}</span>
      <div className="text-right">
        <div className="text-sm font-semibold tabular-nums">
          {fmtNum(p.amount)} {firstWord(p.token)}
        </div>
        <div className={`text-[11px] tabular-nums ${p.apy < 0 ? "text-danger" : "text-ok"}`}>{fmtPct(p.apy)}</div>
      </div>
    </div>
  );
}

function ExtraLine({ p }: { p: ExtraComputation }) {
  const unit = p.origin === "manual" ? p.token : p.unit || "—";
  return (
    <div className="flex items-baseline justify-between gap-2 px-1 py-1.5">
      <span className="text-sm font-medium">{p.token}</span>
      <div className="text-right">
        <div className="text-sm font-semibold tabular-nums">
          {fmtNum(p.amount)} {unit}
        </div>
        <div className="text-[11px] tabular-nums">
          <span className={p.apy < 0 ? "text-danger" : "text-ok"}>{fmtPct(p.apy)}</span>
          <span className="text-muted"> · {p.noPrice ? "no price" : `${fmtEUR(p.perDay)}/day`}</span>
        </div>
      </div>
    </div>
  );
}

function BundleLine({ label, p }: { label: string; p: Row }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="w-14 shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <span className="text-right">
        <span className="text-sm font-semibold tabular-nums">
          {fmtNum(p.amount)} {firstWord(p.token)}
        </span>{" "}
        <span className={`text-[11px] tabular-nums ${p.apy < 0 ? "text-danger" : "text-ok"}`}>({fmtPct(p.apy)})</span>
      </span>
    </div>
  );
}

function BundleView({ b, alert }: { b: Bundle<Row>; alert: CollateralAlert | undefined }) {
  const dist =
    alert?.liqPriceEur != null && alert.currentPriceEur != null ? alert.liqPriceEur / alert.currentPriceEur - 1 : null;
  const parts = [
    alert?.liqPriceEur != null ? `liq ${fmtEUR(alert.liqPriceEur)} €` : null,
    alert?.currentPriceEur != null ? `now ${fmtEUR(alert.currentPriceEur)} €` : null,
    dist != null ? `(${fmtPct(dist, 1)})` : null,
  ].filter(Boolean);
  return (
    <div className="px-1 py-2">
      <div className="text-sm font-semibold">{b.col.token}</div>
      <div className="mt-1 space-y-0.5">
        <BundleLine label="Deposit" p={b.col} />
        {b.debts.map(d => (
          <BundleLine key={d.token} label="Borrow" p={d} />
        ))}
      </div>
      {alert && (
        <div className="mt-1.5">
          <LtvGauge ltv={alert.ltv} target={alert.target} liq={alert.liqThreshold} />
        </div>
      )}
      {parts.length > 0 && <div className="mt-1 text-right text-[11px] text-muted">{parts.join(" · ")}</div>}
    </div>
  );
}

const entryTitle = (rows: ExtraComputation[]) => {
  const p = rows[0];
  if (p.label) return p.label;
  if (p.origin === "manual") return p.token;
  if (p.origin === "jupiter") return shortAddr(p.wallet) || "Jupiter wallet";
  return p.tokens || shortAddr(p.wallet) || "Kamino";
};

const entryEmpty = (rows: ExtraComputation[]) => rows.every(p => !(p.amount > 0));

const entrySummary = (rows: ExtraComputation[]) => {
  const s = rows.map(p => `${fmtNum(p.amount)} ${p.origin === "manual" ? p.token : p.unit || p.token}`).join(", ");
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
};

function groupById(rows: ExtraComputation[]): { id: number; rows: ExtraComputation[] }[] {
  const m = new Map<number, ExtraComputation[]>();
  for (const p of rows) {
    const arr = m.get(p.id) ?? [];
    arr.push(p);
    m.set(p.id, arr);
  }
  return [...m.entries()].map(([id, rs]) => ({ id, rows: rs }));
}

function EntryHead({
  rows,
  canEdit,
  manageHint,
  onEdit,
  onRemove,
}: {
  rows: ExtraComputation[];
  canEdit: boolean;
  manageHint: string | null;
  onEdit: (entry: ExtraComputation) => void;
  onRemove: (rows: ExtraComputation[]) => void;
}) {
  const stale = rows.some(x => x.stale);
  const error = rows.find(x => x.error)?.error;
  return (
    <div className="px-1 pt-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11px] font-bold uppercase tracking-wider text-muted">{entryTitle(rows)}</span>
          {stale && (
            <span className="shrink-0 rounded bg-warn/15 px-1 text-[9px] font-bold uppercase text-warn">stale</span>
          )}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button
            onClick={() => onEdit(rows[0])}
            disabled={!canEdit}
            title={manageHint ?? "Edit position"}
            className="rounded p-1 text-muted hover:bg-card2 disabled:opacity-40"
            aria-label="Edit"
          >
            <IconPencil size={14} />
          </button>
          <button
            onClick={() => onRemove(rows)}
            disabled={!canEdit}
            title={manageHint ?? "Remove position"}
            className="rounded p-1 text-muted hover:bg-card2 hover:text-danger disabled:opacity-40"
            aria-label="Remove"
          >
            <IconTrash size={14} />
          </button>
        </div>
      </div>
      {error && <div className="mt-0.5 text-[10px] text-danger">{error}</div>}
    </div>
  );
}

export function Positions({
  r,
  positions,
  canEdit,
  manageHint,
  onChanged,
  onEdit,
}: {
  r: DashboardResult;
  positions: Row[];
  canEdit: boolean;
  manageHint: string | null;
  onChanged: () => void;
  onEdit: (entry: ExtraComputation) => void;
}) {
  const [confirm, setConfirm] = useState<{ id: number; title: string; summary: string } | null>(null);

  const extras = r.extras.rows;
  const earnBase = positions.filter(p => p.source === "Jupiter Earn");
  const kaminoBase = positions.filter(p => p.source === "Kamino Borrow");
  const borrowBase = positions.filter(p => p.source === "Jupiter Borrow");
  const earnEntries = groupById(extras.filter(p => p.source === "Jupiter Earn"));
  const kaminoEntries = groupById(extras.filter(p => p.source === "Kamino Borrow"));
  const borrowEntries = groupById(extras.filter(p => p.source === "Jupiter Borrow"));

  const manualPlatforms = (() => {
    const m = new Map<string, { id: number; rows: ExtraComputation[] }[]>();
    for (const { id, rows } of groupById(extras.filter(p => p.origin === "manual"))) {
      const plat = rows[0].platform || "";
      const arr = m.get(plat) ?? [];
      arr.push({ id, rows });
      m.set(plat, arr);
    }
    return [...m.entries()].map(([platform, entries]) => ({ platform, entries }));
  })();

  const alertFor = (token: string, id: number | undefined) => r.collaterals.find(c => c.token === token && c.id === id);

  const doRemove = async (id: number) => {
    setConfirm(null);
    if (fixtureMode()) return;
    await fetch(`/api/positions?id=${id}`, { method: "DELETE" }).catch(() => {});
    onChanged();
  };

  const requestRemove = (rows: ExtraComputation[]) => {
    const head = rows[0];
    if (entryEmpty(rows)) {
      void doRemove(head.id);
      return;
    }
    setConfirm({ id: head.id, title: entryTitle(rows), summary: entrySummary(rows) });
  };

  const entryProps = {
    canEdit,
    manageHint,
    onEdit,
    onRemove: requestRemove,
  };

  const baseBundles = borrowBundles(borrowBase);

  return (
    <div className="space-y-3">
      {!canEdit && manageHint && (
        <div className="rounded-lg bg-card2 px-3 py-2 text-[11px] text-muted">{manageHint}</div>
      )}

      {(earnBase.length > 0 || earnEntries.length > 0) && (
        <Card>
          <CardTitle>Jupiter Earn</CardTitle>
          <div className="-mx-1 divide-y divide-line/60">
            {earnBase.map((p, i) => (
              <div key={`${p.token}-${i}`} className="px-1 py-2">
                <PosLine p={p} />
              </div>
            ))}
            {earnEntries.map(({ rows }) => (
              <div key={rows[0].id}>
                <EntryHead rows={rows} {...entryProps} />
                {rows.map(p => (
                  <ExtraLine key={`${p.id}-${p.token}`} p={p} />
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}

      {(kaminoBase.length > 0 || kaminoEntries.length > 0) && (
        <Card>
          <CardTitle>Kamino</CardTitle>
          <div className="-mx-1 divide-y divide-line/60">
            {kaminoBase.map((p, i) => (
              <div key={`${p.token}-${i}`} className="px-1 py-2">
                <PosLine p={p} />
              </div>
            ))}
            {kaminoEntries.map(({ rows }) => (
              <div key={rows[0].id}>
                <EntryHead rows={rows} {...entryProps} />
                {rows.map(p => (
                  <ExtraLine key={`${p.id}-${p.token}`} p={p} />
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}

      {(borrowBase.length > 0 || borrowEntries.length > 0) && (
        <Card>
          <CardTitle>Jupiter Borrow</CardTitle>
          <div className="-mx-1 divide-y divide-line/60">
            {baseBundles.bundles.map(b => (
              <BundleView key={b.col.token} b={b} alert={alertFor(b.col.token, undefined)} />
            ))}
            {baseBundles.leftover.map((p, i) => (
              <div key={`${p.token}-${i}`} className="px-1 py-2">
                <PosLine p={p} />
              </div>
            ))}
            {borrowEntries.map(({ id, rows }) => {
              const { bundles, leftover } = borrowBundles(rows);
              return (
                <div key={id}>
                  <EntryHead rows={rows} {...entryProps} />
                  {bundles.map(b => (
                    <BundleView key={b.col.token} b={b} alert={alertFor(b.col.token, id)} />
                  ))}
                  {leftover.map(p => (
                    <ExtraLine key={`${p.id}-${p.token}`} p={p} />
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {manualPlatforms.map(({ platform, entries }) => (
        <Card key={platform || "manual"}>
          <CardTitle>{platform || "Manual"}</CardTitle>
          <div className="-mx-1 divide-y divide-line/60">
            {entries.map(({ rows }) => (
              <div key={rows[0].id}>
                <EntryHead rows={rows} {...entryProps} />
                {rows.map(p => (
                  <ExtraLine key={`${p.id}-${p.token}`} p={p} />
                ))}
              </div>
            ))}
          </div>
        </Card>
      ))}

      <Card>
        <CardTitle>FiMs EURC / USD</CardTitle>
        <KV label="FiMs EURC (tokens)" value={fmtNum(r.fims.eurc.tokenAmount)} />
        <KV label="FiMs EURC (value)" value={`${fmtEUR(r.fims.eurc.eurAmount)} €`} />
        <KV label="FiMs USD (amount)" value={`${fmtNum(r.fims.usd.usdAmount)} $`} />
        <KV label="FiMs USD (value)" value={`${fmtEUR(r.fims.usd.eurAmount)} €`} />
      </Card>

      {confirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirm(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-line bg-card p-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold">Remove {confirm.title}?</h3>
            <p className="mt-1 text-xs text-muted">It still holds {confirm.summary}.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="rounded-lg border border-line py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => void doRemove(confirm.id)}
                className="rounded-lg bg-danger py-2 text-xs font-semibold text-white"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
