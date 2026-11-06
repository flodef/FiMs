import type { DashboardResult } from "../lib/compute";
import type { PositionRow as Row } from "../lib/types";
import { fmtEUR, fmtNum, fmtPct } from "../lib/format";
import { Card, CardTitle, KV, LtvGauge } from "./ui";

const GROUPS: { source: string; title: string }[] = [
  { source: "Jupiter Earn", title: "Jupiter Earn" },
  { source: "Jupiter Borrow", title: "Jupiter Borrow" },
  { source: "Kamino Borrow", title: "Kamino" },
];

export function Positions({ r, positions }: { r: DashboardResult; positions: Row[] }) {
  return (
    <div className="space-y-3">
      {GROUPS.map(g => {
        const rows = positions.filter(p => p.source === g.source);
        if (!rows.length) return null;
        return (
          <Card key={g.source}>
            <CardTitle>{g.title}</CardTitle>
            <div className="-mx-1 divide-y divide-line/60">
              {rows.map((p, i) => (
                <div key={`${p.token}-${i}`} className="flex items-baseline justify-between px-1 py-2">
                  <div>
                    <div className="text-sm font-medium">{p.token}</div>
                    <div className="text-[11px] text-muted">
                      {p.liqThreshold != null && `liq ${fmtPct(p.liqThreshold)}`}
                      {p.ltv != null && ` · ltv ${fmtPct(p.ltv)}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{fmtNum(p.amount)}</div>
                    <div className={`text-[11px] tabular-nums ${p.apy < 0 ? "text-danger" : "text-ok"}`}>
                      {fmtPct(p.apy)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {r.collaterals.length > 0 && (
        <Card>
          <CardTitle>Collateral health</CardTitle>
          <div className="space-y-4">
            {r.collaterals.map(c => (
              <div key={c.token}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-sm font-semibold">{c.token}</span>
                  <span className="text-[11px] text-muted">{c.source}</span>
                </div>
                <LtvGauge ltv={c.ltv} target={c.target} liq={c.liqThreshold} />
                {c.liqPriceEur != null && (
                  <div className="mt-1 text-right text-[11px] text-muted">liq price ≈ {fmtEUR(c.liqPriceEur)} €</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Strategy positions</CardTitle>
        <div className="-mx-1 divide-y divide-line/60">
          {r.strategyRows
            .filter(s => s.kind !== "fims")
            .map(s => (
              <div key={s.row} className="px-1 py-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm">{s.label}</span>
                  <div className="text-right">
                    {s.kind === "collateral" ? (
                      <span className="text-sm font-semibold tabular-nums">{fmtPct(s.amount)}</span>
                    ) : (
                      <span className="text-sm font-semibold tabular-nums">
                        {s.amount != null ? fmtNum(s.amount) : "—"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between text-[11px] text-muted">
                  <span>
                    {s.kind === "collateral"
                      ? `target ${s.apy != null ? fmtPct(s.apy) : "—"}`
                      : s.kind === "debt"
                        ? "debt"
                        : ""}
                  </span>
                  {s.kind === "collateral" ? (
                    <span className="tabular-nums">
                      {s.liqPriceEur != null ? `liq ${fmtEUR(s.liqPriceEur)} €` : ""}
                    </span>
                  ) : (
                    s.apy != null && (
                      <span className={`tabular-nums ${s.apy < 0 ? "text-danger" : "text-ok"}`}>{fmtPct(s.apy)}</span>
                    )
                  )}
                </div>
              </div>
            ))}
        </div>
      </Card>

      <Card>
        <CardTitle>FiMs</CardTitle>
        <KV label="FiMs EURC (tokens)" value={fmtNum(r.fims.eurc.tokenAmount)} />
        <KV label="FiMs EURC (value)" value={`${fmtEUR(r.fims.eurc.eurAmount)} €`} />
        <KV label="FiMs USD (amount)" value={`${fmtNum(r.fims.usd.usdAmount)} $`} />
        <KV label="FiMs USD (value)" value={`${fmtEUR(r.fims.usd.eurAmount)} €`} />
      </Card>
    </div>
  );
}
