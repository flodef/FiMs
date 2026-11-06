import type { DashboardResult } from "../lib/compute";
import { fmtEUR, fmtNum, fmtPct, timeAgo } from "../lib/format";
import { Card, CardTitle, KV, StatusBadge } from "./ui";

function TotalTile({ label, text }: { label: string; text: string }) {
  return (
    <Card className="px-3 py-3 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 whitespace-nowrap text-lg font-bold tabular-nums sm:text-xl lg:text-2xl">{text}</div>
    </Card>
  );
}

export function Overview({ r, now }: { r: DashboardResult; now: Date }) {
  const nowMs = now.getTime();
  const hasExtras = r.extras.rows.length > 0;
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
        <TotalTile label="Per day" text={r.perDayText} />
        <TotalTile label="Per month" text={r.perMonthText} />
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
              {row.value !== 0 && (
                <div className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-muted">
                  <span>
                    value {fmtNum(row.value)} {row.unit}
                  </span>
                  <span className="text-right">
                    gain/day {fmtNum(row.gainDay)} {row.unit}
                  </span>
                  <span>value/day {fmtEUR(row.valueDay)} €</span>
                  <span className="text-right">value/mo {fmtEUR(row.valueMonth, 0)} €</span>
                </div>
              )}
            </div>
          ))}
          <div className="px-1 py-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold">TOTAL</span>
              <span className="text-sm font-bold tabular-nums">{fmtPct(r.borrowLend.totalGainPct)}</span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-muted">
              <span />
              <span className="text-right font-medium text-zinc-200">{fmtEUR(r.borrowLend.totalValueDay)} €/day</span>
              <span />
              <span className="text-right font-medium text-zinc-200">
                {fmtEUR(r.borrowLend.totalValueMonth, 0)} €/mo
              </span>
            </div>
          </div>
          {hasExtras && (
            <div className="px-1 py-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-muted">Other positions</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-muted">
                <span />
                <span className="text-right font-medium text-zinc-200">{fmtEUR(r.extras.perDay)} €/day</span>
                <span />
                <span className="text-right font-medium text-zinc-200">{fmtEUR(r.extras.perMonth, 0)} €/mo</span>
              </div>
            </div>
          )}
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
