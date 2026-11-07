import type { DashboardResult } from "../lib/compute";
import { fmtEUR, fmtNum } from "../lib/format";
import { Card, CardTitle } from "./ui";

const FX_KEYS = new Set(["I13", "I15"]);

export function Prices({ r, hideTitle = false }: { r: DashboardResult; hideTitle?: boolean }) {
  const tokens = r.prices.filter(p => !FX_KEYS.has(p.key));
  const fx = (key: string) => r.prices.find(p => p.key === key);
  return (
    <div className="space-y-3">
      <Card>
        {!hideTitle && <CardTitle>Prices (EUR)</CardTitle>}
        <div className="-mx-1 divide-y divide-line/60">
          {tokens.map(p => (
            <div key={p.key} className="flex items-baseline justify-between px-1 py-2.5">
              <div className="text-sm font-medium">{p.label}</div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">{fmtEUR(p.eur, p.eur < 10 ? 3 : 2)}</div>
                {p.usd != null && (
                  <div className="text-[11px] text-muted tabular-nums">{fmtNum(p.usd, p.usd < 10 ? 3 : 2)} $</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardTitle>FX</CardTitle>
        <div className="-mx-1 divide-y divide-line/60">
          {(
            [
              ["EUR → USD", fx("I13")],
              ["USD → EUR", fx("I15")],
            ] as const
          ).map(([label, p]) => (
            <div key={label} className="flex items-baseline justify-between px-1 py-2.5">
              <div className="text-sm font-medium">{label}</div>
              <div className="text-sm font-semibold tabular-nums">{p ? fmtNum(p.eur, 5) : "—"}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
