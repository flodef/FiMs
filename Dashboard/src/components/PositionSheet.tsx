import { IconX } from "@tabler/icons-react";
import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import type { ExtraComputation } from "../lib/compute";
import { fixtureMode } from "../lib/fixture";
import type { TrackedKind } from "../lib/types";

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

const KINDS: { id: KindTab; label: string }[] = [
  { id: "manual", label: "Manual" },
  { id: "jupiter", label: "Jupiter wallet" },
  { id: "kamino", label: "Kamino wallet" },
];

export function PositionSheet({
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

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

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
