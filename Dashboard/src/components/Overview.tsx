import type { DashboardResult } from "../lib/compute";
import { fmtEUR, fmtNum, fmtPct, timeAgo } from "../lib/format";
import { BigStat, Card, CardTitle, KV, StatusBadge } from "./ui";

export function Overview({ r, now }: { r: DashboardResult; now: Date }) {
  const nowMs = now.getTime();
  return (
    <div className="space-y-3">
      <Card className="flex items-center justify-between">
        <div>
          <StatusBadge status={r.status} />
          {r.stale && (
            <span className="ml-2 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold uppercase text-warn">
              stale
            </span>
          )}
          {r.failedSources.length > 0 && (
            <div className="mt-1 text-[11px] text-danger">failed: {r.failedSources.join(", ")}</div>
          )}
        </div>
        <div className="text-right text-[11px] leading-4 text-muted">
          <div>Prices {timeAgo(r.priceUpdatedAt, nowMs)}</div>
          <div>Positions {timeAgo(r.positionsUpdatedAt, nowMs)}</div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <BigStat label="Grand total" value={fmtEUR(r.perDay)} sub="€ / day" />
        <BigStat label="per month" value={fmtEUR(r.perMonth, 0)} sub="€ / month" />
      </div>

      <Card>
        <CardTitle>Borrow / Lend</CardTitle>
        <div className="-mx-1 divide-y divide-line/60">
          {r.borrowLend.rows.map(row => (
            <div key={row.key} className="px-1 py-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">{row.label}</span>
                <span className={`text-sm font-semibold tabular-nums ${row.gainPct < 0 ? "text-danger" : "text-ok"}`}>
                  {fmtPct(row.gainPct)}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-muted">
                <span>value {fmtEUR(row.value)}</span>
                <span className="text-right">gain/day {fmtEUR(row.gainDay)}</span>
                <span>value/day {fmtEUR(row.valueDay)}</span>
                <span className="text-right">value/mo {fmtEUR(row.valueMonth, 0)}</span>
              </div>
            </div>
          ))}
          <div className="px-1 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold">TOTAL</span>
              <span className="text-sm font-bold tabular-nums">{fmtPct(r.borrowLend.totalGainPct)}</span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-muted">
              <span />
              <span className="text-right font-medium text-zinc-200">{fmtEUR(r.borrowLend.totalValueDay)}/day</span>
              <span />
              <span className="text-right font-medium text-zinc-200">{fmtEUR(r.borrowLend.totalValueMonth, 0)}/mo</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardTitle>JLP forecast</CardTitle>
          <div className="text-xl font-bold tabular-nums">{fmtEUR(r.forecasts.jlpPerDay)}</div>
          <div className="text-[11px] text-muted">€ / day</div>
        </Card>
        <Card>
          <CardTitle>JUP forecast</CardTitle>
          <div className="text-xl font-bold tabular-nums">{fmtEUR(r.forecasts.jupPerDay)}</div>
          <div className="text-[11px] text-muted">€ / day</div>
        </Card>
      </div>

      <Card>
        <CardTitle>JupSOL</CardTitle>
        <KV label="Value" value={`${fmtEUR(r.jupsol.value)} €`} />
        <KV label="Ratio (SOL/JupSOL)" value={fmtNum(r.jupsol.ratio, 6)} mono />
        <KV label={`Perf${r.jupsol.apySource === "jupiter" ? " (jupiter)" : ""}`} value={fmtPct(r.jupsol.apy)} />
      </Card>
    </div>
  );
}
