import type { DashboardResult } from "../lib/compute";
import { fmtEUR, fmtNum, fmtPct } from "../lib/format";
import { Card, CardTitle } from "./ui";

const MULTIPLY_ROWS: { label: string; get: (r: DashboardResult) => [number, number]; pct?: boolean }[] = [
  { label: "Total", get: r => [r.multiply.jlpTotal, r.multiply.jlpValue] },
  { label: "Init", get: r => [r.multiply.init, r.multiply.initValue] },
  { label: "Current", get: r => [r.multiply.current, r.multiply.currentValue] },
  { label: "DEBT", get: r => [r.multiply.debt, r.multiply.debtValue] },
  { label: "Debit / day", get: r => [r.multiply.debitDay, r.multiply.debitDayValue] },
  { label: "Credit / day", get: r => [r.multiply.creditDay, r.multiply.creditDayValue] },
  { label: "TOTAL / day", get: r => [r.multiply.totalDay, r.multiply.totalDayValue] },
  { label: "Gains", get: r => [r.multiply.gains, r.multiply.gainsValue] },
  { label: "Annualized", get: r => [0, r.multiply.gainsAnnual], pct: true },
];

const eur = (v: number) => `${fmtEUR(v)} €`;

const FIMS_ROWS: { label: string; get: (r: DashboardResult) => number; fmt: (v: number) => string }[] = [
  { label: "Total / Sol ratio", get: r => r.fims.totalSolRatio, fmt: v => fmtPct(v) },
  { label: "JLP Day Average", get: r => r.fims.jlpDayAverage, fmt: v => fmtNum(v, 4) },
  { label: "FiMs SOL Diff", get: r => r.fims.fimsSolDiff, fmt: v => fmtNum(v, 2) },
  { label: "FiMs EURC Diff", get: r => r.fims.fimsEurcDiff, fmt: eur },
  { label: "JLP Ratio", get: r => r.fims.jlpRatio, fmt: v => fmtNum(v, 2) },
  { label: "FiMs Token", get: r => r.fims.fimsToken, fmt: eur },
  { label: "Due per day", get: r => r.fims.duePerDay, fmt: eur },
  { label: "TOTAL", get: r => r.fims.total, fmt: eur },
];

export function Multiply({ r }: { r: DashboardResult }) {
  return (
    <div className="space-y-3">
      <Card>
        <CardTitle>FiMs</CardTitle>
        <div className="-mx-1 divide-y divide-line/60">
          {FIMS_ROWS.map(row => (
            <div key={row.label} className="flex items-baseline justify-between px-1 py-2">
              <span className="text-sm">{row.label}</span>
              <span className="text-sm font-semibold tabular-nums">{row.fmt(row.get(r))}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Multiply — JLP</CardTitle>
        <div className="-mx-1 divide-y divide-line/60">
          {MULTIPLY_ROWS.map(row => {
            const [jlp, value] = row.get(r);
            return (
              <div key={row.label} className="flex items-baseline justify-between px-1 py-2">
                <span className="text-sm">{row.label}</span>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums">{row.pct ? fmtPct(value) : fmtNum(jlp)}</div>
                  <div className="text-[11px] text-muted tabular-nums">{row.pct ? "" : `${fmtEUR(value)} €`}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
