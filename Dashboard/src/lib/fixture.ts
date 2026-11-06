import type { Inputs } from "./types";

export function fixtureMode(): boolean {
  if (typeof location === "undefined") return false;
  if (!new URLSearchParams(location.search).has("fixture")) return false;
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
}

export async function loadFixtureInputs(): Promise<Inputs | null> {
  try {
    const mod = await import("./__fixtures__/sheet-2026-11-06.json");
    return mod.default as unknown as Inputs;
  } catch {
    return null;
  }
}
