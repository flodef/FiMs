import {
  IconArrowsExchange,
  IconBell,
  IconBellOff,
  IconCurrencyBitcoin,
  IconDeviceDesktop,
  IconInfoCircle,
  IconLogout,
  IconMoon,
  IconRefresh,
  IconSend,
  IconSun,
  IconWallet,
} from "@tabler/icons-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { DEFAULT_OFFCHAIN, type OffchainHoldings } from "../lib/offchain";
import { currentSubscription, pushSupported, sendTestPush, subscribePush, unsubscribePush } from "../lib/push";
import { setSlippageBps, slippageBps, SLIPPAGE_CHOICES } from "../lib/slippage";
import { setTheme, themePref, type ThemePref } from "../lib/theme";
import pkg from "../../package.json";

const SettingsWallet = lazy(() => import("./wallet/SettingsWallet"));

const THEMES: { id: ThemePref; label: string; icon: typeof IconSun }[] = [
  { id: "system", label: "System", icon: IconDeviceDesktop },
  { id: "light", label: "Light", icon: IconSun },
  { id: "dark", label: "Dark", icon: IconMoon },
];
const THEME_CYCLE: ThemePref[] = ["system", "light", "dark"];

/** Tap-toggle tooltip for a settings row label (mobile-friendly alternative to title=). */
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return (
    <span className="relative inline-flex">
      <button
        onClick={e => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        className="rounded p-0.5 text-muted hover:text-ink"
        aria-label="More info"
      >
        <IconInfoCircle size={13} />
      </button>
      {open && (
        <span className="absolute left-5 top-5 z-20 w-48 rounded-lg border border-line bg-card2 p-2 text-[11px] leading-snug text-muted shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

export function Settings({
  onClose,
  onRefresh,
  onLogout,
  offchain,
  readOnly,
}: {
  onClose: () => void;
  onRefresh: () => void;
  onLogout: () => void;
  /** current off-chain holdings (from /api/dashboard inputs); defaults when absent */
  offchain?: OffchainHoldings;
  /** fixture/demo mode — show defaults, no editing */
  readOnly?: boolean;
}) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pref, setPref] = useState<ThemePref>(themePref());
  const [slip, setSlip] = useState<number>(slippageBps());
  const [ocXbtc, setOcXbtc] = useState(String(offchain?.xBTC ?? DEFAULT_OFFCHAIN.xBTC));
  const [ocZec, setOcZec] = useState(String(offchain?.ZEC ?? DEFAULT_OFFCHAIN.ZEC));
  const [ocMsg, setOcMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ocBusy, setOcBusy] = useState(false);
  const supported = pushSupported();

  useEffect(() => {
    void currentSubscription().then(s => setSubscribed(!!s));
  }, []);

  // resync the inputs when fresh holdings arrive (adjust-state-on-prop-change)
  const [ocSeen, setOcSeen] = useState(offchain);
  if (ocSeen !== offchain) {
    setOcSeen(offchain);
    setOcXbtc(String(offchain?.xBTC ?? DEFAULT_OFFCHAIN.xBTC));
    setOcZec(String(offchain?.ZEC ?? DEFAULT_OFFCHAIN.ZEC));
  }

  const saveOffchain = async () => {
    const xBTC = Number(ocXbtc);
    const ZEC = Number(ocZec);
    if (!Number.isFinite(xBTC) || xBTC < 0 || xBTC > 1e9 || !Number.isFinite(ZEC) || ZEC < 0 || ZEC > 1e9) {
      setOcMsg({ ok: false, text: "Enter amounts ≥ 0 (max 1e9)" });
      return;
    }
    setOcBusy(true);
    setOcMsg(null);
    try {
      const res = await fetch("/api/offchain", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ xBTC, ZEC }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setOcMsg({ ok: false, text: data.error ?? `HTTP ${res.status}` });
        return;
      }
      setOcMsg({ ok: true, text: "Saved — total updated" });
      onRefresh();
    } catch {
      setOcMsg({ ok: false, text: "Network error — try again." });
    } finally {
      setOcBusy(false);
    }
  };

  const toggle = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (subscribed) {
        await unsubscribePush();
        setSubscribed(false);
      } else {
        const r = await subscribePush();
        setSubscribed(r.ok);
        if (!r.ok) setMsg({ ok: false, text: r.error ?? "failed" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="divide-y divide-line/60">
        <button
          onClick={() => {
            const next = THEME_CYCLE[(THEME_CYCLE.indexOf(pref) + 1) % THEME_CYCLE.length];
            setTheme(next);
            setPref(next);
          }}
          className="flex w-full items-center gap-3 py-3 text-left"
        >
          {(() => {
            const Icon = THEMES.find(t => t.id === pref)?.icon ?? IconDeviceDesktop;
            return <Icon size={18} className="text-muted" />;
          })()}
          <span className="flex-1 text-sm">
            Theme · {pref === "system" ? "System" : pref === "light" ? "Light" : "Dark"}
          </span>
        </button>
        <button
          onClick={toggle}
          disabled={busy || !supported}
          className="flex w-full items-center justify-between py-3 text-left disabled:opacity-50"
        >
          <span className="flex items-center gap-3 text-sm">
            {subscribed ? <IconBell size={18} className="text-ok" /> : <IconBellOff size={18} className="text-muted" />}
            Push notifications {subscribed ? "on" : "off"}
          </span>
          <span className="text-xs text-muted">{busy ? "…" : supported ? "" : "unsupported"}</span>
        </button>
        {msg && <p className={`py-2 text-[11px] ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>}

        {subscribed && (
          <button
            onClick={async () => {
              setBusy(true);
              setMsg(null);
              const r = await sendTestPush();
              // the arriving notification is the feedback — only surface failures
              setMsg(r.ok ? null : { ok: false, text: r.error ?? "failed" });
              setBusy(false);
            }}
            disabled={busy}
            className="flex w-full items-center gap-3 py-3 text-left text-sm disabled:opacity-50"
          >
            <IconSend size={18} className="text-muted" /> Send test notification
          </button>
        )}

        <div className="py-3">
          <div className="flex items-center gap-3 text-sm">
            <IconArrowsExchange size={18} className="text-muted" />
            <span className="flex items-center gap-1">
              Swap slippage
              <InfoTip text="Volatile pairs (JupSOL, JLP, EURC). Stablecoin swaps stay at 0.01%." />
            </span>
            <span className="flex-1" />
            <select
              value={slip}
              onChange={e => {
                const v = Number(e.target.value);
                setSlippageBps(v);
                setSlip(v);
              }}
              aria-label="Swap slippage"
              className="rounded-lg border border-line bg-card2 px-2 py-1.5 text-xs font-medium text-ink outline-none focus:border-accent"
            >
              {SLIPPAGE_CHOICES.map(c => (
                <option key={c.bps} value={c.bps}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="py-3">
          <div className="flex items-center gap-3 text-sm">
            <IconCurrencyBitcoin size={18} className="text-muted" />
            <span className="flex items-center gap-1">
              Off-chain holdings
              <InfoTip text="Tokens held outside the tracked wallets — counted in the Total at live prices." />
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 pl-8">
            {(
              [
                ["xBTC", ocXbtc, setOcXbtc],
                ["ZEC", ocZec, setOcZec],
              ] as const
            ).map(([label, val, set]) => (
              <label key={label} className="flex items-center gap-1.5 text-xs text-muted">
                {label}
                <input
                  inputMode="decimal"
                  value={val}
                  onChange={e => set(e.target.value)}
                  disabled={readOnly}
                  className="w-24 rounded-lg border border-line bg-card2 px-2 py-1.5 text-xs font-medium text-ink outline-none focus:border-accent disabled:opacity-60"
                  aria-label={`${label} off-chain amount`}
                />
              </label>
            ))}
            {!readOnly && (
              <button
                onClick={() => void saveOffchain()}
                disabled={ocBusy}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {ocBusy ? "…" : "Save"}
              </button>
            )}
            {ocMsg && <span className={`text-[11px] ${ocMsg.ok ? "text-ok" : "text-danger"}`}>{ocMsg.text}</span>}
          </div>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center gap-3 py-3 text-sm">
              <IconWallet size={18} className="text-muted" /> Wallet
            </div>
          }
        >
          <SettingsWallet />
        </Suspense>

        <button
          onClick={() => {
            onRefresh();
            onClose();
          }}
          className="flex w-full items-center gap-3 py-3 text-left text-sm"
        >
          <IconRefresh size={18} className="text-muted" /> Refresh data
        </button>
        <button onClick={onLogout} className="flex w-full items-center gap-3 py-3 text-left text-sm text-danger">
          <IconLogout size={18} /> Log out
        </button>
      </div>

      <div className="mt-4 text-center text-[11px] text-muted">FiMs Dashboard v{pkg.version}</div>
    </div>
  );
}
