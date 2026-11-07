import {
  IconArrowsExchange,
  IconChartLine,
  IconCoin,
  IconInfoCircle,
  IconLayoutDashboard,
  IconPlus,
  IconSettings,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useState } from "react";
import { computeDashboard, type DashboardResult, type ExtraComputation } from "./lib/compute";
import { timeAgo } from "./lib/format";
import { useDashboard } from "./hooks/useDashboard";
import { Overview } from "./components/Overview";
import { Positions } from "./components/Positions";
import { PositionSheet } from "./components/PositionSheet";
import { Multiply } from "./components/Multiply";
import { Prices } from "./components/Prices";
import { ConvertTab } from "./components/Convert";
import { Settings } from "./components/Settings";
import { Login } from "./components/Login";
import { Drawer, StatusBadge } from "./components/ui";

type Tab = "overview" | "positions" | "multiply" | "prices" | "convert";

const TABS: { id: Tab; label: string; icon: typeof IconLayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: IconLayoutDashboard },
  { id: "positions", label: "Positions", icon: IconWallet },
  { id: "multiply", label: "Multiply", icon: IconChartLine },
  { id: "prices", label: "Prices", icon: IconCoin },
  { id: "convert", label: "Convert", icon: IconArrowsExchange },
];

function InfoPopover({ r, nowMs }: { r: DashboardResult; nowMs: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const lines = [
    r.priceUpdatedAt ? `Prices updated ${timeAgo(r.priceUpdatedAt, nowMs)}` : "Prices: never",
    r.positionsUpdatedAt ? `Positions updated ${timeAgo(r.positionsUpdatedAt, nowMs)}` : "Positions: never",
    r.staleSources.length ? `Stale: ${r.staleSources.join(", ")}` : null,
    r.failedSources.length ? `Failed: ${r.failedSources.join(", ")}` : null,
  ].filter((l): l is string => l !== null);
  return (
    <div className="group relative">
      <button
        onClick={e => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        className="rounded-lg p-1.5 text-muted hover:bg-card2"
        aria-label="Data info"
      >
        <IconInfoCircle size={16} />
      </button>
      <div
        className={`absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-line bg-card p-3 text-left text-[11px] leading-5 text-muted shadow-xl ${open ? "" : "hidden group-hover:block"}`}
        onClick={e => e.stopPropagation()}
      >
        {lines.map(l => (
          <div key={l}>{l}</div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const { inputs, auth, offline, sessionExpired, loading, now, refresh, setAuth } = useDashboard();
  const [tab, setTab] = useState<Tab>("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [posSheet, setPosSheet] = useState<{ open: boolean; editing: ExtraComputation | null }>({
    open: false,
    editing: null,
  });
  const [drawer, setDrawer] = useState<"prices" | "convert" | null>(null);

  const result = useMemo(() => (inputs ? computeDashboard(inputs, now) : null), [inputs, now]);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    setAuth("anon");
    setSettingsOpen(false);
  };

  if (loading && !inputs) {
    return <div className="flex min-h-dvh items-center justify-center text-sm text-muted">Loading…</div>;
  }

  if (!inputs) {
    if (auth === "anon") return <Login onSuccess={() => void refresh()} />;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6">
        <p className="text-sm text-muted">{offline ? "Cannot reach the dashboard server." : "No data yet."}</p>
        <button
          onClick={() => void refresh()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!result) return null;

  const canEditPositions = auth === "authed" && !offline;
  const manageHint = canEditPositions
    ? null
    : offline
      ? "Offline — reconnect to manage positions."
      : "Log in to manage positions.";

  const unitOptions = [
    "EUR",
    "USD",
    ...new Set(
      inputs.defi.priceHeaders.map(h => /\(([^()]*)\)\s*$/.exec(h)?.[1]).filter((s): s is string => Boolean(s)),
    ),
  ];

  const positionsProps = {
    r: result,
    positions: inputs.positions,
    canEdit: canEditPositions,
    manageHint,
    onChanged: () => void refresh(),
    onEdit: (entry: ExtraComputation) => setPosSheet({ open: true, editing: entry }),
  };

  const headerBtn = "flex items-center gap-1 rounded-lg p-2 text-muted hover:bg-card2";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg lg:max-w-[1400px]">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:px-6">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold">FiMs</span>
          <StatusBadge status={result.status} />
          <InfoPopover r={result} nowMs={now.getTime()} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDrawer("prices")}
            className="hidden items-center gap-1 rounded-lg p-2 text-muted hover:bg-card2 lg:flex"
            aria-label="Prices"
            title="Prices"
          >
            <IconCoin size={18} />
          </button>
          <button
            onClick={() => setDrawer("convert")}
            className="hidden items-center gap-1 rounded-lg p-2 text-muted hover:bg-card2 lg:flex"
            aria-label="Convert"
            title="Convert"
          >
            <IconArrowsExchange size={18} />
          </button>
          <button
            onClick={() => setPosSheet({ open: true, editing: null })}
            disabled={!canEditPositions}
            title={manageHint ?? "Add position"}
            className={`${headerBtn} disabled:opacity-40`}
            aria-label="Add position"
          >
            <IconPlus size={18} />
          </button>
          <button onClick={() => setSettingsOpen(true)} className={headerBtn} aria-label="Settings">
            <IconSettings size={18} />
          </button>
        </div>
      </header>

      {offline && (
        <div className="bg-warn/15 px-4 py-2 text-center text-xs text-warn lg:px-6">
          Offline — data from {timeAgo(inputs.fetchedAt, now.getTime())}
        </div>
      )}
      {auth === "anon" && (
        <div className="flex items-center justify-between gap-2 bg-accent/15 px-4 py-2 text-xs text-accent lg:px-6">
          <span>{sessionExpired ? "Session expired" : "Login required"} — showing cached data</span>
          <button onClick={() => setLoginOpen(true)} className="font-semibold underline">
            Log in
          </button>
        </div>
      )}
      {result.stale && !offline && (
        <div className="bg-warn/15 px-4 py-2 text-center text-xs text-warn lg:px-6">
          Some sources are stale: {result.staleSources.join(", ")}
        </div>
      )}

      <main className="flex-1 px-4 pb-24 pt-3 lg:px-6 lg:pb-10">
        <div className="lg:hidden">
          {tab === "overview" && <Overview r={result} />}
          {tab === "positions" && <Positions {...positionsProps} />}
          {tab === "multiply" && <Multiply r={result} />}
          {tab === "prices" && <Prices r={result} />}
          {tab === "convert" && <ConvertTab r={result} />}
        </div>

        <div className="hidden lg:grid lg:grid-cols-3 lg:items-start lg:gap-4">
          <div className="min-w-0 space-y-3">
            <Overview r={result} />
          </div>
          <div className="min-w-0 space-y-3">
            <Positions {...positionsProps} />
          </div>
          <div className="min-w-0 space-y-3">
            <Multiply r={result} />
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-1/2 z-40 flex w-full max-w-md -translate-x-1/2 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${active ? "text-accent" : "text-muted"}`}
            >
              <Icon size={20} stroke={active ? 2.2 : 1.8} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {settingsOpen && (
        <Drawer title="Settings" onClose={() => setSettingsOpen(false)}>
          <Settings
            onClose={() => setSettingsOpen(false)}
            onRefresh={() => void refresh()}
            onLogout={() => void logout()}
          />
        </Drawer>
      )}

      {posSheet.open && (
        <PositionSheet
          editing={posSheet.editing}
          unitOptions={unitOptions}
          onClose={() => setPosSheet({ open: false, editing: null })}
          onSaved={() => {
            setPosSheet({ open: false, editing: null });
            void refresh();
          }}
        />
      )}

      {drawer === "prices" && (
        <Drawer title="Prices (EUR)" onClose={() => setDrawer(null)}>
          <Prices r={result} hideTitle />
        </Drawer>
      )}
      {drawer === "convert" && (
        <Drawer title="Convert" onClose={() => setDrawer(null)} wide>
          <ConvertTab r={result} />
        </Drawer>
      )}

      {loginOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setLoginOpen(false)}
        >
          <div onClick={e => e.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button onClick={() => setLoginOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-card2">
                <IconX size={18} />
              </button>
            </div>
            <Login
              compact
              onSuccess={() => {
                setLoginOpen(false);
                void refresh();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
