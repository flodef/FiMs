import type { ExtraPosition, Inputs } from "./types.js";

export function fixtureMode(): boolean {
  if (typeof location === "undefined") return false;
  if (!new URLSearchParams(location.search).has("fixture")) return false;
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
}

// Fixture-only extras so the tracked-positions UI is visible in ?fixture screenshots.
// Sources mirror fetchJupiter/fetchKamino output (only EURC maps to "Jupiter Earn").
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
    source: "Jupiter Borrow",
    amount: 10,
    apy: 0.065,
    unit: "SOL",
    label: "Alt wallet",
    wallet: "58kZBjjtHShTtXFmygr3ZT8VSU4dH28PanRAdouHbToh",
    stale: true,
  },
  {
    id: -2,
    origin: "jupiter",
    token: "JLP",
    source: "Jupiter Borrow",
    amount: 100,
    apy: 0.12,
    unit: "JLP",
    ltv: 0.36,
    liqThreshold: 0.9,
    label: "Alt wallet",
    wallet: "58kZBjjtHShTtXFmygr3ZT8VSU4dH28PanRAdouHbToh",
    stale: true,
  },
  {
    id: -2,
    origin: "jupiter",
    token: "USDT JLP",
    source: "Jupiter Borrow",
    amount: 150,
    apy: -0.06,
    unit: "USDT",
    label: "Alt wallet",
    wallet: "58kZBjjtHShTtXFmygr3ZT8VSU4dH28PanRAdouHbToh",
    stale: true,
  },
  {
    id: -3,
    origin: "kamino",
    token: "USDC",
    source: "Kamino Borrow",
    amount: 1000,
    apy: 0.05,
    unit: "USDC",
    label: "Lend",
    wallet: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    tokens: "USDC",
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
