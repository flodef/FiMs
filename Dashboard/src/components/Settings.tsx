import {
  IconArrowsExchange,
  IconBell,
  IconBellOff,
  IconDeviceDesktop,
  IconLogout,
  IconMoon,
  IconRefresh,
  IconSend,
  IconSun,
  IconWallet,
} from "@tabler/icons-react";
import { lazy, Suspense, useEffect, useState } from "react";
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

export function Settings({
  onClose,
  onRefresh,
  onLogout,
}: {
  onClose: () => void;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pref, setPref] = useState<ThemePref>(themePref());
  const [slip, setSlip] = useState<number>(slippageBps());
  const supported = pushSupported();

  useEffect(() => {
    void currentSubscription().then(s => setSubscribed(!!s));
  }, []);

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
        if (!r.ok) setMsg(r.error ?? "failed");
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
        {msg && <p className="py-2 text-[11px] text-danger">{msg}</p>}

        {subscribed && (
          <button
            onClick={async () => {
              setBusy(true);
              setMsg(null);
              const r = await sendTestPush();
              setMsg(r.ok ? "Test sent — check your notifications" : (r.error ?? "failed"));
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
            <span className="flex-1">Swap slippage</span>
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
          <p className="mt-1 pl-8 text-[11px] text-muted">
            Volatile pairs (JupSOL, JLP, EURC). Stablecoin swaps stay at 0.01%.
          </p>
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
