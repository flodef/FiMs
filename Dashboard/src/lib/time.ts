import { START_DATE } from "./config";

const dtf = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

interface WallParts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

function parisParts(ms: number): WallParts {
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(ms))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    y: parts.year ?? 0,
    mo: parts.month ?? 1,
    d: parts.day ?? 1,
    h: (parts.hour ?? 0) % 24,
    mi: parts.minute ?? 0,
    s: parts.second ?? 0,
  };
}

function parisOffsetMs(utcMs: number): number {
  const w = parisParts(utcMs);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - utcMs;
}

export function parisWallToUtcMs(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number {
  const wallUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const utc = wallUtc - parisOffsetMs(wallUtc);
  return wallUtc - parisOffsetMs(utc);
}

/** Sheets/Excel serial date (Paris wall time) → epoch ms. */
export function serialToParisMs(serial: number): number {
  const ms = (serial - 25569) * 86400000;
  const d = new Date(ms);
  return parisWallToUtcMs(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  );
}

export function daysInMonthParis(ms: number): number {
  const w = parisParts(ms);
  return new Date(Date.UTC(w.y, w.mo, 0)).getUTCDate();
}

export function daysSinceStart(ms: number): number {
  return (ms - parisWallToUtcMs(START_DATE.y, START_DATE.m, START_DATE.d)) / 86400000;
}
