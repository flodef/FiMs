import { IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { convert, priceMapFromCells, UNITS, type Unit } from "../lib/convert";
import type { DashboardResult } from "../lib/compute";
import { fmtNum } from "../lib/format";
import { Card, CardTitle } from "./ui";

const DECIMALS: Record<Unit, number> = { EUR: 2, USD: 2, FIMS: 2, FSOL: 3, FLiP: 3, SOL: 4, BTC: 8, JUP: 2, ZEC: 6 };
const STORAGE_KEY = "fims-convert";

const sanitize = (v: string) => {
  const cleaned = v.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  if (!/\d/.test(cleaned)) return "";
  const [intPart, ...fracParts] = cleaned.split(".");
  const int = intPart.replace(/^0+(?=\d)/, "").slice(0, 6) || "0";
  if (!cleaned.includes(".")) return int;
  return `${int}.${fracParts.join("").slice(0, 4)}`;
};

function loadSaved(): { amount: string; unit: Unit } {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (p && typeof p === "object") {
      return {
        amount: sanitize(String(p.amount ?? "")),
        unit: UNITS.includes(p.unit) ? p.unit : "EUR",
      };
    }
  } catch {
    /* corrupted storage — fall through to defaults */
  }
  return { amount: "1", unit: "EUR" };
}

export function ConvertTab({ r }: { r: DashboardResult }) {
  const [saved] = useState(loadSaved);
  const [amount, setAmount] = useState(saved.amount);
  const [unit, setUnit] = useState<Unit>(saved.unit);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ amount, unit }));
    } catch {
      /* storage may be unavailable */
    }
  }, [amount, unit]);

  const qty = amount === "" ? NaN : Number(amount);
  const out = useMemo(
    () => (Number.isFinite(qty) ? convert(qty, unit, priceMapFromCells(r.cells)) : null),
    [qty, unit, r.cells],
  );

  return (
    <div className="space-y-3">
      <Card>
        <CardTitle>Amount</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative w-[120px] shrink-0">
            <input
              ref={inputRef}
              inputMode="decimal"
              pattern="[0-9.,]*"
              value={amount}
              onChange={e => setAmount(sanitize(e.target.value))}
              className="w-full rounded-lg border border-line bg-card2 py-2.5 pl-3 pr-7 text-base font-semibold tabular-nums outline-none focus:border-accent"
            />
            {amount !== "" && (
              <button
                type="button"
                aria-label="Clear"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  setAmount("");
                  inputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                <IconX size={14} />
              </button>
            )}
          </div>
          <select
            value={unit}
            onChange={e => setUnit(e.target.value as Unit)}
            aria-label="Unit"
            className="min-w-0 flex-1 rounded-lg border border-line bg-card2 px-3 py-2.5 text-base font-semibold outline-none focus:border-accent lg:hidden"
          >
            {UNITS.map(u => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-1.5 lg:flex">
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
