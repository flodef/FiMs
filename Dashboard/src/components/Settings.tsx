import { IconBell, IconBellOff, IconLogout, IconRefresh, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { currentSubscription, pushSupported, subscribePush, unsubscribePush } from "../lib/push";
import pkg from "../../package.json";

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border-t border-line bg-card p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">Settings</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-card2">
            <IconX size={20} />
          </button>
        </div>

        <div className="divide-y divide-line/60">
          <button
            onClick={toggle}
            disabled={busy || !supported}
            className="flex w-full items-center justify-between py-3 text-left disabled:opacity-50"
          >
            <span className="flex items-center gap-3 text-sm">
              {subscribed ? (
                <IconBell size={18} className="text-ok" />
              ) : (
                <IconBellOff size={18} className="text-muted" />
              )}
              Push notifications {subscribed ? "on" : "off"}
            </span>
            <span className="text-xs text-muted">{busy ? "…" : supported ? "" : "unsupported"}</span>
          </button>
          {ios && (
            <p className="py-2 text-[11px] leading-4 text-muted">
              On iOS, add the app to your Home Screen first (Share → Add to Home Screen), then enable notifications
              here.
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
    </div>
  );
}
