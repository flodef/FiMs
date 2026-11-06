const stripNegZero = (s: string) => (/^-0(?:\.0+)?$/.test(s) ? s.slice(1) : s);

const loc = (v: number, decimals: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export function fmtEUR(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return stripNegZero(loc(v, decimals));
}

export function fmtPct(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${stripNegZero(loc(v * 100, decimals))}%`;
}

export function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return stripNegZero(loc(v, decimals));
}

export function fmtSignedEUR(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = fmtEUR(Math.abs(v));
  return v < 0 ? `−${s}` : `+${s}`;
}

export function timeAgo(ms: number | null | undefined, now: number): string {
  if (ms == null || !Number.isFinite(ms)) return "never";
  const mins = Math.max(0, Math.round((now - ms) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
