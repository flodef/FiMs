import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconChartLine,
  IconCoin,
  IconCreditCard,
  IconInfoCircle,
  IconLayoutDashboard,
  IconPlus,
  IconScale,
  IconSettings,
  IconWallet,
  IconX,
} from "@tabler/icons-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import pkg from "../package.json";
import { SHEET_SYNC_TOLERANCE_EUR } from "./lib/config";
import { computeDashboard, type DashboardResult, type ExtraComputation } from "./lib/compute";
import { fmtNum, fmtSOL, timeAgo } from "./lib/format";
import { checkForUpdate } from "./lib/pwa";
import type { Inputs, SourceName } from "./lib/types";
import { useDashboard } from "./hooks/useDashboard";
import { Overview } from "./components/Overview";
import { Positions } from "./components/Positions";
import { PositionSheet } from "./components/PositionSheet";
import { Multiply } from "./components/Multiply";
import { Prices } from "./components/Prices";
import { ConvertTab } from "./components/Convert";
import { Settings } from "./components/Settings";
import { Login } from "./components/Login";
import { Drawer, StatusBadge, Toast } from "./components/ui";

const Rebalance = lazy(() => import("./components/Rebalance"));
const Topup = lazy(() => import("./components/Topup"));

type Tab = "overview" | "positions" | "multiply" | "prices" | "convert";

const SOURCE_LABELS: Record<SourceName, string> = {
  jupiter: "Jupiter",
  kamino: "Kamino",
  sanctum: "Sanctum",
  defi: "DeFi sheet",
};

const TABS: { id: Tab; label: string; icon: typeof IconLayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: IconLayoutDashboard },
  { id: "positions", label: "Positions", icon: IconWallet },
  { id: "multiply", label: "Multiply", icon: IconChartLine },
  { id: "prices", label: "Prices", icon: IconCoin },
  { id: "convert", label: "Convert", icon: IconArrowsExchange },
];

function InfoPopover({ r, sources, nowMs }: { r: DashboardResult; sources: Inputs["sources"]; nowMs: number }) {
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
    r.staleSources.length
      ? `Stale: ${r.staleSources
          .map(s => {
            const err = sources[s]?.error;
            return `${SOURCE_LABELS[s] ?? s}${err ? ` (${err})` : ""}`;
          })
          .join(", ")}`
      : null,
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

const signedNum = (v: number) => `${v < 0 ? "−" : "+"}${fmtNum(Math.abs(v), 0)}`;

/** Warns that the DeFi sheet's IMPORTRANGE'd values lagged — total uses live data instead. Tap for details. */
function SheetSyncNotice({ sync, correction }: { sync: DashboardResult["sheetSync"]; correction: number }) {
  const [open, setOpen] = useState(false);
  const bad = sync.items.filter(i => Math.abs(i.impactEur) > SHEET_SYNC_TOLERANCE_EUR);
  const shown = bad.length ? bad : sync.items;
  return (
    <div className="bg-warn/15 px-4 py-2 text-xs text-warn lg:px-6">
      <button onClick={() => setOpen(o => !o)} className="mx-auto flex items-center gap-1.5" aria-expanded={open}>
        <IconAlertTriangle size={13} className="shrink-0" />
        <span>DeFi sheet out of sync — total corrected with live data ({signedNum(correction)} €)</span>
      </button>
      {open && shown.length > 0 && (
        <div className="mt-1 space-y-0.5 text-center">
          {shown.map(i => (
            <div key={i.label}>
              {i.label}: sheet {signedNum(i.sheet)} · live {signedNum(i.live)}
            </div>
          ))}
        </div>
      )}
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
  const [drawer, setDrawer] = useState<"prices" | "convert" | "rebalance" | "topup" | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "error"; msg: string; duration?: number } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.duration ?? 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // after a PWA update reload, tell the user which version they're now on
  useEffect(() => {
    const t = setTimeout(() => {
      const KEY = "fims-last-version";
      try {
        const prev = localStorage.getItem(KEY);
        if (prev && prev !== pkg.version) {
          setToast({ kind: "ok", msg: `Updated to v${pkg.version}`, duration: 4000 });
        }
        localStorage.setItem(KEY, pkg.version);
      } catch {
        /* storage blocked — skip */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

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
  const manageHint =
    auth === "unknown" || canEditPositions
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
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur lg:px-6">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold">FiMs</span>
          <button onClick={() => setTab("positions")} aria-label="Show positions" className="rounded-md">
            <StatusBadge status={result.status} />
          </button>
          <InfoPopover r={result} sources={inputs.sources} nowMs={now.getTime()} />
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
          <button
            onClick={() => setDrawer("rebalance")}
            disabled={!canEditPositions}
            title={manageHint ?? "Rebalance"}
            className={`${headerBtn} disabled:opacity-40`}
            aria-label="Rebalance"
          >
            <IconScale size={18} />
          </button>
          <button
            onClick={() => setDrawer("topup")}
            disabled={!canEditPositions}
            title={manageHint ?? "Top up card"}
            className={`${headerBtn} disabled:opacity-40`}
            aria-label="Top up card"
          >
            <IconCreditCard size={18} />
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
          Using cached data for{" "}
          {result.staleSources
            .map(s => {
              const st = inputs.sources[s];
              const ago = st?.at ? timeAgo(st.at, now.getTime()) : null;
              return `${SOURCE_LABELS[s] ?? s}${ago ? ` (${ago})` : ""}`;
            })
            .join(", ")}
        </div>
      )}
      {!result.sheetSync.inSync && <SheetSyncNotice sync={result.sheetSync} correction={result.fims.totalCorrection} />}

      <main className="flex-1 px-4 pb-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] pt-3 lg:px-6 lg:pb-10">
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
              className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${active ? "text-accent" : "text-muted"}`}
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
            onRefresh={async () => {
              checkForUpdate();
              const r = await refresh();
              setToast(
                r === "ok"
                  ? { kind: "ok", msg: "Data refreshed" }
                  : r === "offline"
                    ? { kind: "error", msg: "Refresh failed — offline" }
                    : r === "expired"
                      ? { kind: "error", msg: "Session expired — log in again" }
                      : { kind: "error", msg: "Refresh already in progress" },
              );
            }}
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
      {drawer === "rebalance" && (
        <Drawer title="Rebalance" onClose={() => setDrawer(null)} wide>
          <Suspense fallback={<p className="text-xs text-muted">Loading…</p>}>
            <Rebalance
              onDone={lamports => {
                setDrawer(null);
                void refresh();
                setToast({
                  kind: "ok",
                  msg: lamports ? `Rebalance done · fees ${fmtSOL(lamports)} SOL` : "Rebalance done",
                  duration: 6000,
                });
              }}
            />
          </Suspense>
        </Drawer>
      )}
      {drawer === "topup" && (
        <Drawer title="Top up card" onClose={() => setDrawer(null)} wide>
          <Suspense fallback={<p className="text-xs text-muted">Loading…</p>}>
            <Topup
              eurToUsd={result.cells["I13"] ?? 0}
              onDone={lamports => {
                setDrawer(null);
                void refresh();
                setToast({
                  kind: "ok",
                  msg: lamports ? `Card topped up · fees ${fmtSOL(lamports)} SOL` : "Card topped up",
                  duration: 6000,
                });
              }}
            />
          </Suspense>
        </Drawer>
      )}

      {toast && <Toast kind={toast.kind} message={toast.msg} />}

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
