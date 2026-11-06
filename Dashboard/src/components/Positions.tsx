import { IconPencil, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import type { DashboardResult, ExtraComputation } from "../lib/compute";
import { fixtureMode } from "../lib/fixture";
import { fmtEUR, fmtNum, fmtPct } from "../lib/format";
import type { PositionRow as Row, TrackedKind } from "../lib/types";
import { Card, CardTitle, KV, LtvGauge } from "./ui";

const GROUPS: { source: string; title: string }[] = [
  { source: "Jupiter Earn", title: "Jupiter Earn" },
  { source: "Kamino Borrow", title: "Kamino" },
];

const firstWord = (t: string) => t.trim().split(/\s+/)[0] ?? t;
const lastWord = (t: string) => t.trim().split(/\s+/).pop() ?? t;
const shortAddr = (w?: string) => (w && w.length > 12 ? `${w.slice(0, 4)}…${w.slice(-4)}` : (w ?? ""));

interface Bundle {
  col: Row;
  debts: Row[];
}

function borrowBundles(rows: Row[]): { bundles: Bundle[]; leftover: Row[] } {
  const isDebtOf = (p: Row, col: string) =>
    p.token !== col && /\s/.test(p.token.trim()) && lastWord(p.token).toLowerCase() === col.toLowerCase();
  const cols = rows.filter(p => p.ltv != null || rows.some(d => isDebtOf(d, p.token)));
  const bundles = cols.map(col => ({ col, debts: rows.filter(d => isDebtOf(d, col.token)) }));
  const inBundle = new Set<Row>(bundles.flatMap(b => [b.col, ...b.debts]));
  return { bundles, leftover: rows.filter(p => !inBundle.has(p)) };
}

function PosLine({ p, indent = false }: { p: Row; indent?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between ${indent ? "mt-1 pl-4" : ""}`}>
      <span className={indent ? "text-xs text-muted" : "text-sm font-medium"}>{p.token}</span>
      <div className="text-right">
        <div className={`tabular-nums ${indent ? "text-xs" : "text-sm font-semibold"}`}>
          {fmtNum(p.amount)} {firstWord(p.token)}
        </div>
        <div className={`text-[11px] tabular-nums ${p.apy < 0 ? "text-danger" : "text-ok"}`}>{fmtPct(p.apy)}</div>
      </div>
    </div>
  );
}

type KindTab = TrackedKind;

const inputCls = "w-full rounded-lg border border-line bg-card2 px-3 py-2 text-sm outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}

interface SheetState {
  label: string;
  platform: string;
  asset: string;
  amount: string;
  apyPct: string;
  unit: string;
  wallet: string;
  tokens: string;
}

const EMPTY_FORM: SheetState = {
  label: "",
  platform: "",
  asset: "",
  amount: "",
  apyPct: "",
  unit: "USD",
  wallet: "",
  tokens: "",
};

function PositionSheet({
  editing,
  unitOptions,
  onClose,
  onSaved,
}: {
  editing: ExtraComputation | null;
  unitOptions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<KindTab>(editing?.origin ?? "manual");
  const [form, setForm] = useState<SheetState>(() => {
    if (!editing) return EMPTY_FORM;
    return {
      label: editing.label ?? "",
      platform: editing.platform ?? "",
      asset: editing.origin === "manual" ? editing.token : "",
      amount: editing.origin === "manual" ? String(editing.amount) : "",
      apyPct: editing.origin === "manual" ? String(editing.apy * 100) : "",
      unit: editing.unit || "USD",
      wallet: editing.wallet ?? "",
      tokens: editing.tokens ?? "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof SheetState) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (fixtureMode()) {
      setError("Fixture mode — positions are not saved.");
      return;
    }
    if (kind === "manual" && (!form.asset.trim() || !form.amount.trim() || !form.apyPct.trim())) {
      setError("Asset, amount and APY are required.");
      return;
    }
    if (kind !== "manual" && !form.wallet.trim()) {
      setError("Wallet address is required.");
      return;
    }
    if (kind === "kamino" && !form.tokens.trim()) {
      setError("Tokens are required (e.g. USDC,USDT).");
      return;
    }
    const payload: Record<string, unknown> = {
      kind,
      label: form.label.trim() || null,
      platform: kind === "manual" ? form.platform.trim() || null : null,
      wallet: kind === "manual" ? null : form.wallet.trim(),
      tokens: kind === "kamino" ? form.tokens.trim() : null,
      asset: kind === "manual" ? form.asset.trim() : null,
      amount: kind === "manual" ? Number(form.amount) : null,
      apy: kind === "manual" ? Number(form.apyPct) / 100 : null,
      unit: kind === "manual" ? form.unit : null,
    };
    if (editing) payload.id = editing.id;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/positions", {
        method: editing ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      onSaved();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  };

  const KINDS: { id: KindTab; label: string }[] = [
    { id: "manual", label: "Manual" },
    { id: "jupiter", label: "Jupiter wallet" },
    { id: "kamino", label: "Kamino wallet" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">{editing ? "Edit position" : "Add position"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-card2" aria-label="Close">
            <IconX size={18} />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-card2 p-1">
          {KINDS.map(k => (
            <button
              key={k.id}
              onClick={() => setKind(k.id)}
              className={`rounded-md px-2 py-1.5 text-xs font-semibold ${kind === k.id ? "bg-accent text-white" : "text-muted"}`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <Field label="Label (optional)">
            <input className={inputCls} value={form.label} onChange={set("label")} placeholder="e.g. Cold wallet" />
          </Field>

          {kind === "manual" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Asset">
                  <input className={inputCls} value={form.asset} onChange={set("asset")} placeholder="USDT, JLP…" />
                </Field>
                <Field label="Platform">
                  <input
                    className={inputCls}
                    value={form.platform}
                    onChange={set("platform")}
                    placeholder="Manual, Ledger…"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Amount">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={form.amount}
                    onChange={set("amount")}
                    placeholder="0"
                  />
                </Field>
                <Field label="APY %">
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={form.apyPct}
                    onChange={set("apyPct")}
                    placeholder="8"
                  />
                </Field>
              </div>
              <Field label="Unit (pricing)">
                <select className={inputCls} value={form.unit} onChange={set("unit")}>
                  {unitOptions.map(u => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {kind !== "manual" && (
            <>
              <Field label="Wallet">
                <input
                  className={`${inputCls} font-mono text-xs`}
                  value={form.wallet}
                  onChange={set("wallet")}
                  placeholder="Solana address"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </Field>
              {kind === "kamino" && (
                <Field label="Tokens">
                  <input className={inputCls} value={form.tokens} onChange={set("tokens")} placeholder="USDC,USDT" />
                </Field>
              )}
              <p className="text-[11px] leading-4 text-muted">
                {kind === "jupiter"
                  ? "Tracks the wallet's full Jupiter portfolio (earn + borrow)."
                  : "Tracks deposits of the listed tokens on Kamino."}
              </p>
            </>
          )}

          {error && <div className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div>}

          <button
            onClick={() => void save()}
            disabled={saving}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Add position"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Positions({
  r,
  positions,
  unitOptions,
  canEdit,
  manageHint,
  onChanged,
}: {
  r: DashboardResult;
  positions: Row[];
  unitOptions: string[];
  canEdit: boolean;
  manageHint: string | null;
  onChanged: () => void;
}) {
  const [sheet, setSheet] = useState<{ open: boolean; editing: ExtraComputation | null }>({
    open: false,
    editing: null,
  });

  // Group extras: section = origin (+platform for manual), entry = tracked row id.
  const sections = useMemo(() => {
    const secMap = new Map<string, { title: string; entries: Map<number, ExtraComputation[]> }>();
    for (const p of r.extras.rows) {
      const manual = p.origin === "manual";
      const key = manual ? `manual|${p.platform ?? ""}` : p.origin;
      let sec = secMap.get(key);
      if (!sec) {
        sec = {
          title: manual ? p.platform || "Manual" : p.origin === "jupiter" ? "Jupiter wallets" : "Kamino wallets",
          entries: new Map(),
        };
        secMap.set(key, sec);
      }
      const arr = sec.entries.get(p.id) ?? [];
      arr.push(p);
      sec.entries.set(p.id, arr);
    }
    return [...secMap.values()];
  }, [r.extras.rows]);

  const entryTitle = (rows: ExtraComputation[]) => {
    const p = rows[0];
    if (p.label) return p.label;
    if (p.origin === "manual") return p.token;
    if (p.origin === "jupiter") return `Jupiter · ${shortAddr(p.wallet)}`;
    return `Kamino · ${p.tokens ?? ""}`;
  };

  const entrySub = (rows: ExtraComputation[]) => {
    const p = rows[0];
    if (p.origin === "manual") return p.platform || "manual";
    if (p.origin === "jupiter") return shortAddr(p.wallet);
    return p.tokens ?? "";
  };

  const remove = async (id: number) => {
    if (fixtureMode()) return;
    if (!window.confirm("Delete this position?")) return;
    await fetch(`/api/positions?id=${id}`, { method: "DELETE" }).catch(() => {});
    onChanged();
  };

  const { bundles, leftover } = borrowBundles(positions.filter(p => p.source === "Jupiter Borrow"));
  const borrowRows = positions.filter(p => p.source === "Jupiter Borrow");

  return (
    <div className="space-y-3">
      {GROUPS.map(g => {
        const rows = positions.filter(p => p.source === g.source);
        if (!rows.length) return null;
        return (
          <Card key={g.source}>
            <CardTitle>{g.title}</CardTitle>
            <div className="-mx-1 divide-y divide-line/60">
              {rows.map((p, i) => (
                <div key={`${p.token}-${i}`} className="px-1 py-2">
                  <PosLine p={p} />
                  {(p.liqThreshold != null || p.ltv != null) && (
                    <div className="mt-0.5 text-[11px] text-muted">
                      {p.liqThreshold != null && `liq ${fmtPct(p.liqThreshold)}`}
                      {p.ltv != null && ` · ltv ${fmtPct(p.ltv)}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {borrowRows.length > 0 && (
        <Card>
          <CardTitle>Jupiter Borrow</CardTitle>
          <div className="-mx-1 divide-y divide-line/60">
            {bundles.map(b => {
              const alert = r.collaterals.find(c => c.token === b.col.token);
              return (
                <div key={b.col.token} className="px-1 py-2">
                  <PosLine p={b.col} />
                  {(b.col.ltv != null || b.col.liqThreshold != null) && (
                    <div className="mt-0.5 text-[11px] text-muted">
                      {b.col.ltv != null && `LTV ${fmtPct(b.col.ltv)}`}
                      {b.col.liqThreshold != null && ` · liq ${fmtPct(b.col.liqThreshold)}`}
                      {alert?.liqPriceEur != null && ` · liq price ≈ ${fmtEUR(alert.liqPriceEur)} €`}
                    </div>
                  )}
                  {b.debts.map(d => (
                    <PosLine key={d.token} p={d} indent />
                  ))}
                </div>
              );
            })}
            {leftover.map((p, i) => (
              <div key={`${p.token}-${i}`} className="px-1 py-2">
                <PosLine p={p} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {r.collaterals.length > 0 && (
        <Card>
          <CardTitle>Collateral health</CardTitle>
          <div className="space-y-4">
            {r.collaterals.map(c => {
              const dist =
                c.liqPriceEur != null && c.currentPriceEur != null ? c.liqPriceEur / c.currentPriceEur - 1 : null;
              const parts = [
                c.liqPriceEur != null ? `liq ${fmtEUR(c.liqPriceEur)} €` : null,
                c.currentPriceEur != null ? `now ${fmtEUR(c.currentPriceEur)} €` : null,
                dist != null ? `(${fmtPct(dist, 1)})` : null,
              ].filter(Boolean);
              return (
                <div key={`${c.token}-${c.source}`}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{c.token}</span>
                    <span className="text-[11px] text-muted">{c.source}</span>
                  </div>
                  <LtvGauge ltv={c.ltv} target={c.target} liq={c.liqThreshold} />
                  {parts.length > 0 && (
                    <div className="mt-1 text-right text-[11px] text-muted">{parts.join(" · ")}</div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <CardTitle
          right={
            <button
              onClick={() => setSheet({ open: true, editing: null })}
              disabled={!canEdit}
              className="flex items-center gap-1 rounded-lg bg-accent/15 px-2 py-1 text-[11px] font-semibold text-accent disabled:opacity-40"
            >
              <IconPlus size={13} /> Add
            </button>
          }
        >
          Other positions
        </CardTitle>
        {manageHint && <div className="mb-2 text-[11px] text-muted">{manageHint}</div>}
        {sections.length === 0 ? (
          <div className="py-2 text-center text-xs text-muted">No extra positions tracked.</div>
        ) : (
          <div className="space-y-3">
            {sections.map(sec => (
              <div key={sec.title}>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">{sec.title}</div>
                <div className="-mx-1 divide-y divide-line/60">
                  {[...sec.entries.values()].map(rows => {
                    const head = rows[0];
                    const anyStale = rows.some(x => x.stale);
                    return (
                      <div key={head.id} className="px-1 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">{entryTitle(rows)}</span>
                            {anyStale && (
                              <span className="shrink-0 rounded bg-warn/15 px-1 text-[9px] font-bold uppercase text-warn">
                                stale
                              </span>
                            )}
                          </div>
                          {canEdit && (
                            <div className="flex shrink-0 gap-0.5">
                              <button
                                onClick={() => setSheet({ open: true, editing: head })}
                                className="rounded p-1 text-muted hover:bg-card2"
                                aria-label="Edit"
                              >
                                <IconPencil size={14} />
                              </button>
                              <button
                                onClick={() => void remove(head.id)}
                                className="rounded p-1 text-muted hover:bg-card2 hover:text-danger"
                                aria-label="Delete"
                              >
                                <IconTrash size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] text-muted">{entrySub(rows)}</div>
                        {rows.map(p => (
                          <div key={`${p.id}-${p.token}`} className="mt-1 flex items-baseline justify-between gap-2">
                            <span className="text-xs text-muted">
                              {p.token} · {fmtNum(p.amount)} {p.origin === "manual" ? p.token : p.unit}
                            </span>
                            <span className="text-right text-[11px] tabular-nums">
                              <span className={p.apy < 0 ? "text-danger" : "text-ok"}>{fmtPct(p.apy)}</span>
                              <span className="text-muted">
                                {" "}
                                · {p.noPrice ? "no price" : `${fmtEUR(p.perDay)}/day`}
                              </span>
                            </span>
                          </div>
                        ))}
                        {rows.some(x => x.error) && (
                          <div className="mt-0.5 text-[10px] text-danger">{rows.find(x => x.error)?.error}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>FiMs EURC / USD</CardTitle>
        <KV label="FiMs EURC (tokens)" value={fmtNum(r.fims.eurc.tokenAmount)} />
        <KV label="FiMs EURC (value)" value={`${fmtEUR(r.fims.eurc.eurAmount)} €`} />
        <KV label="FiMs USD (amount)" value={`${fmtNum(r.fims.usd.usdAmount)} $`} />
        <KV label="FiMs USD (value)" value={`${fmtEUR(r.fims.usd.eurAmount)} €`} />
      </Card>

      {sheet.open && (
        <PositionSheet
          editing={sheet.editing}
          unitOptions={unitOptions}
          onClose={() => setSheet({ open: false, editing: null })}
          onSaved={() => {
            setSheet({ open: false, editing: null });
            onChanged();
          }}
        />
      )}
    </div>
  );
}
