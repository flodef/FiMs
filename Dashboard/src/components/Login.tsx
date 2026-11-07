import { useState } from "react";
import { IconEye, IconEyeOff, IconLock } from "@tabler/icons-react";

export function Login({ onSuccess, compact = false }: { onSuccess: () => void; compact?: boolean }) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        setError("Wrong password");
      }
    } catch {
      setError("Cannot reach server");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={compact ? "" : "flex min-h-dvh items-center justify-center bg-bg p-6"}>
      <div className={compact ? "" : "w-full max-w-xs rounded-2xl border border-line bg-card p-6"}>
        {!compact && (
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-card2">
              <IconLock size={22} className="text-accent" />
            </div>
            <h1 className="text-lg font-bold">FiMs Dashboard</h1>
            <p className="mt-1 text-xs text-muted">Enter the dashboard password</p>
          </div>
        )}
        {compact && <p className="mb-3 text-sm font-semibold">Log in to refresh data</p>}
        <div className="relative">
          <input
            type={visible ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            autoComplete="current-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-lg border border-line bg-card2 py-2.5 pl-3 pr-11 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink"
          >
            {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-3 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "…" : "Log in"}
        </button>
      </div>
    </form>
  );
}
