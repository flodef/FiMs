import type { DashboardResult } from "../lib/compute";
import { fmtEUR, fmtNum, fmtPct } from "../lib/format";
import { Card, CardTitle, KV } from "./ui";

function Half({ label, value, unit, big = true }: { label?: string; value: string; unit: string; big?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-2 py-1 text-center">
      {label && <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>}
      <div className="flex items-baseline justify-center gap-1 whitespace-nowrap">
        <span className={`${big ? "text-xl sm:text-2xl" : "text-lg"} font-bold tabular-nums`}>{value}</span>
        <span className="text-xs text-muted">{unit}</span>
      </div>
    </div>
  );
}

export function Overview({ r }: { r: DashboardResult }) {
  const hasExtras = r.extras.rows.length > 0;
  const totalLine = `${fmtEUR(r.borrowLend.totalValueDay)} € / day · ${fmtEUR(r.borrowLend.totalValueMonth, 0)} € / month`;
  const extrasLine = `${fmtEUR(r.extras.perDay)} € / day · ${fmtEUR(r.extras.perMonth, 0)} € / month`;
  return (
    <div className="space-y-3">
      <Card>
        <CardTitle>Gains</CardTitle>
        <div className="grid grid-cols-2 divide-x divide-line/60">
          <Half value={fmtEUR(r.perDay)} unit="€ / day" />
          <Half value={fmtEUR(r.perMonth, 0)} unit="€ / month" />
        </div>
      </Card>

      <Card>
        <CardTitle>Forecast</CardTitle>
        <div className="grid grid-cols-2 divide-x divide-line/60">
          <Half label="JLP" value={fmtEUR(r.forecasts.jlpPerDay)} unit="€ / day" />
          <Half label="JUP" value={fmtEUR(r.forecasts.jupPerDay)} unit="€ / day" />
        </div>
      </Card>

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
                    value: {fmtNum(row.value)} {row.unit}
                  </span>
                  <span className="text-right">
                    gain/day: {fmtNum(row.gainDay)} {row.unit}
                  </span>
                  <span>value/day: {fmtEUR(row.valueDay)} €</span>
                  <span className="text-right">value/mo: {fmtEUR(row.valueMonth, 0)} €</span>
                </div>
              )}
            </div>
          ))}
          <div className="flex items-baseline justify-between px-1 py-2">
            <span className="text-sm font-bold">TOTAL</span>
            <span className="flex items-baseline gap-2">
              <span className="text-sm font-bold tabular-nums">{fmtPct(r.borrowLend.totalGainPct)}</span>
              <span className="whitespace-nowrap text-right text-[11px] font-medium text-ink">{totalLine}</span>
            </span>
          </div>
          {hasExtras && (
            <div className="flex items-baseline justify-between px-1 py-2">
              <span className="text-sm font-semibold text-muted">Other positions</span>
              <span className="whitespace-nowrap text-right text-[11px] font-medium text-ink">{extrasLine}</span>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>JupSOL</CardTitle>
        <KV label="Value" value={`${fmtEUR(r.jupsol.value)} €`} />
        <KV label="Ratio (SOL/JupSOL)" value={fmtNum(r.jupsol.ratio, 6)} mono />
        <KV label={`Perf${r.jupsol.apySource === "jupiter" ? " (jupiter)" : ""}`} value={fmtPct(r.jupsol.apy)} />
      </Card>
    </div>
  );
}
