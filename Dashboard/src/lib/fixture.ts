import type { ExtraPosition, Inputs } from "./types.js";

export function fixtureMode(): boolean {
  if (typeof location === "undefined") return false;
  if (!new URLSearchParams(location.search).has("fixture")) return false;
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
}

// Fixture-only extras so the "Other positions" UI is visible in ?fixture screenshots.
const FIXTURE_EXTRAS: ExtraPosition[] = [
  {
    id: -1,
    origin: "manual",
    token: "USDT",
    source: "Manual",
    amount: 5000,
    apy: 0.08,
    unit: "USD",
    label: "Cold wallet",
    platform: "Manual",
  },
  {
    id: -2,
    origin: "jupiter",
    token: "SOL",
    source: "Jupiter Earn",
    amount: 10,
    apy: 0.065,
    unit: "SOL",
    label: "SOL staking",
    wallet: "58kZBjjtHShTtXFmygr3ZT8VSU4dH28PanRAdouHbToh",
    stale: true,
  },
];

export async function loadFixtureInputs(): Promise<Inputs | null> {
  try {
    const mod = await import("./__fixtures__/sheet-2026-11-06.json");
    const fx = mod.default as unknown as Inputs;
    fx.extraPositions = FIXTURE_EXTRAS.map(e => ({ ...e }));
    return fx;
  } catch {
    return null;
  }
}
