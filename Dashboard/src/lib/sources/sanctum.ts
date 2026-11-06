import { FETCH_TIMEOUT_MS } from "../config";

export interface SanctumRaw {
  jupsolRatio: number;
  jupsolApy: number;
}

async function sget(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`sanctum → HTTP ${res.status}`);
  return res.json();
}

export async function fetchSanctum(): Promise<SanctumRaw> {
  const [value, apy] = await Promise.all([
    sget("https://extra-api.sanctum.so/v1/sol-value/current?lst=jupsol"),
    sget("https://extra-api.sanctum.so/v1/apy/latest?lst=jupsol"),
  ]);
  const raw = value?.solValues?.jupsol ?? value?.value ?? value?.solValue ?? 0;
  const jupsolRatio = Number(raw) / 1e9;
  const jupsolApy = Number(apy?.apys?.jupsol ?? apy?.jupsol ?? 0);
  return { jupsolRatio, jupsolApy };
}
