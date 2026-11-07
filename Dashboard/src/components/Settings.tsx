import {
  IconBell,
  IconBellOff,
  IconDeviceDesktop,
  IconLogout,
  IconMoon,
  IconRefresh,
  IconSun,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { currentSubscription, pushSupported, subscribePush, unsubscribePush } from "../lib/push";
import { setTheme, themePref, type ThemePref } from "../lib/theme";
import pkg from "../../package.json";

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
  const supported = pushSupported();
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

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
        {ios && (
          <p className="py-2 text-[11px] leading-4 text-muted">
            On iOS, add the app to your Home Screen first (Share → Add to Home Screen), then enable notifications here.
          </p>
        )}
        {msg && <p className="py-2 text-[11px] text-danger">{msg}</p>}

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
