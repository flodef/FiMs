import { useEffect, useMemo, useRef, useState } from "react";
import { convert, priceMapFromCells, UNITS, type Unit } from "../lib/convert";
import type { DashboardResult } from "../lib/compute";
import { fmtNum } from "../lib/format";
import { Card, CardTitle } from "./ui";

const DECIMALS: Record<Unit, number> = { EUR: 2, USD: 2, FIMS: 2, FSOL: 3, FLiP: 3, SOL: 4, BTC: 8, JUP: 2, ZEC: 6 };

export function ConvertTab({ r }: { r: DashboardResult }) {
  const [amount, setAmount] = useState("90");
  const [unit, setUnit] = useState<Unit>("EUR");
  const sanitize = (v: string) => {
    const cleaned = v.replace(/,/g, ".").replace(/[^0-9.]/g, "");
    if (!/\d/.test(cleaned)) return "";
    const [intPart, ...fracParts] = cleaned.split(".");
    const int = intPart.replace(/^0+(?=\d)/, "").slice(0, 6) || "0";
    if (!cleaned.includes(".")) return int;
    return `${int}.${fracParts.join("").slice(0, 4)}`;
  };
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const qty = amount === "" ? NaN : Number(amount);
  const out = useMemo(
    () => (Number.isFinite(qty) ? convert(qty, unit, priceMapFromCells(r.cells)) : null),
    [qty, unit, r.cells],
  );

  return (
    <div className="space-y-3">
      <Card>
        <CardTitle>Amount</CardTitle>
        <div className="flex flex-wrap items-start gap-2">
          <input
            ref={inputRef}
            inputMode="decimal"
            pattern="[0-9.,]*"
            value={amount}
            onChange={e => setAmount(sanitize(e.target.value))}
            className="w-[120px] shrink-0 rounded-lg border border-line bg-card2 px-3 py-2.5 text-base font-semibold tabular-nums outline-none focus:border-accent"
          />
          <div className="flex min-w-0 flex-1 basis-44 flex-wrap gap-1.5">
            {UNITS.map(u => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${u === unit ? "bg-accent text-white" : "bg-card2 text-muted"}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Conversions</CardTitle>
        <div className="-mx-1 divide-y divide-line/60">
          {UNITS.map(u => (
            <div key={u} className="flex items-baseline justify-between px-1 py-2.5">
              <span className={`text-sm ${u === unit ? "font-semibold" : "text-muted"}`}>{u}</span>
              <span className="text-sm font-semibold tabular-nums">{out ? fmtNum(out[u], DECIMALS[u]) : "—"}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
