import { IconAlertTriangle, IconCircleCheck, IconX } from "@tabler/icons-react";
import { useEffect, type ReactNode } from "react";
import { fmtPct } from "../lib/format";
import type { StatusLevel } from "../lib/compute";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-card p-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{children}</h3>
      {right}
    </div>
  );
}

const STATUS_STYLE: Record<StatusLevel, string> = {
  ok: "bg-ok/15 text-ok",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/15 text-danger",
  error: "bg-danger/15 text-danger",
};

export function StatusBadge({ status }: { status: StatusLevel }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

export function KV({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  tone?: "pos" | "neg" | "muted";
}) {
  const toneCls = tone === "pos" ? "text-ok" : tone === "neg" ? "text-danger" : tone === "muted" ? "text-muted" : "";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${mono ? "font-mono" : ""} ${toneCls}`}>{value}</span>
    </div>
  );
}

export function BigStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="text-center">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

export function Toast({ kind, message }: { kind: "ok" | "error"; message: string }) {
  const Icon = kind === "ok" ? IconCircleCheck : IconAlertTriangle;
  return (
    <div
      role="status"
      className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-card px-4 py-2.5 text-sm shadow-xl lg:bottom-6"
    >
      <Icon size={16} className={kind === "ok" ? "text-ok" : "text-danger"} />
      {message}
    </div>
  );
}

export function Drawer({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-card2" aria-label="Close">
            <IconX size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LtvGauge({ ltv, target, liq }: { ltv: number; target: number | null; liq: number | null }) {
  const pct = (v: number) => Math.min(100, Math.max(0, v * 100));
  return (
    <div>
      <div className="relative h-2 w-full rounded-full bg-line">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${ltv >= (liq ?? 1) * 0.95 ? "bg-danger" : target != null && ltv > target ? "bg-warn" : "bg-ok"}`}
          style={{ width: `${pct(ltv)}%` }}
        />
        {liq != null && <div className="absolute inset-y-[-3px] w-0.5 bg-danger/80" style={{ left: `${pct(liq)}%` }} />}
        {target != null && (
          <div className="absolute inset-y-[-3px] w-0.5 bg-accent" style={{ left: `${pct(target)}%` }} />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>LTV {fmtPct(ltv)}</span>
        <span>{target != null ? `target ${fmtPct(target)}` : ""}</span>
        <span>{liq != null ? `liq ${fmtPct(liq)}` : ""}</span>
      </div>
    </div>
  );
}
