import type { CollateralAlert, DashboardResult } from "../lib/compute";
import { fmtEUR, fmtNum, fmtPct } from "../lib/format";
import { Card, CardTitle } from "./ui";

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

function KeyFig({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-1 py-1 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="flex items-baseline justify-center gap-1 whitespace-nowrap">
        <span className="text-base font-bold tabular-nums sm:text-lg">{value}</span>
        {unit && <span className="text-[11px] text-muted">{unit}</span>}
      </div>
    </div>
  );
}

function LtvFig({ label, alert }: { label: string; alert: CollateralAlert | undefined }) {
  const color =
    alert?.level === "warn" ? "text-warn" : alert?.level === "danger" ? "text-danger" : alert ? "text-ok" : "";
  return (
    <div className="flex min-w-0 flex-col items-center px-1 py-1 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      {!alert ? (
        <div className="text-sm font-bold text-muted">—</div>
      ) : (
        <div className="whitespace-nowrap text-[13px] font-bold tabular-nums sm:text-sm">
          <span className={color}>{fmtPct(alert.ltv)}</span>
          <span className="font-medium text-muted"> / {alert.target != null ? fmtPct(alert.target, 0) : "—"}</span>
        </div>
      )}
    </div>
  );
}

export function Overview({ r }: { r: DashboardResult }) {
  const hasExtras = r.extras.rows.length > 0;
  const totalLine = `${fmtEUR(r.borrowLend.totalValueDay)} € / day · ${fmtEUR(r.borrowLend.totalValueMonth, 0)} € / month`;
  const extrasLine = `${fmtEUR(r.extras.perDay)} € / day · ${fmtEUR(r.extras.perMonth, 0)} € / month`;
  const baseAlert = (token: string) =>
    r.collaterals.find(c => c.id === undefined && c.token.trim().toLowerCase() === token);
  return (
    <div className="space-y-3">
      <Card>
        <CardTitle>Key figures</CardTitle>
        <div className="grid grid-cols-3 divide-x divide-line/60">
          <KeyFig label="Total" value={fmtEUR(r.fims.total, 0)} unit="€" />
          <LtvFig label="JLP LTV" alert={baseAlert("jlp")} />
          <LtvFig label="JupSOL LTV" alert={baseAlert("jupsol")} />
        </div>
      </Card>

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
    </div>
  );
}
