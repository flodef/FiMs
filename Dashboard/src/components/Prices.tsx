import type { DashboardResult } from "../lib/compute";
import { fmtEUR, fmtNum } from "../lib/format";
import { Card, CardTitle } from "./ui";

export function Prices({ r, hideTitle = false }: { r: DashboardResult; hideTitle?: boolean }) {
  return (
    <Card>
      {!hideTitle && <CardTitle>Prices (EUR)</CardTitle>}
      <div className="-mx-1 divide-y divide-line/60">
        {r.prices.map(p => (
          <div key={p.key} className="flex items-baseline justify-between px-1 py-2.5">
            <div className="text-sm font-medium">{p.label}</div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums">
                {p.key === "I13" ? fmtNum(p.eur, 5) : fmtEUR(p.eur, p.eur < 10 ? 3 : 2)}
              </div>
              {p.usd != null && (
                <div className="text-[11px] text-muted tabular-nums">{fmtNum(p.usd, p.usd < 10 ? 3 : 2)} $</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
