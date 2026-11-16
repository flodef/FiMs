import { SLIPPAGE_BPS_OPTIONS } from "./rebalance/plan";

const LS_KEY = "fims-slippage-bps";
const DEFAULT_BPS = 5;

/** Volatile-pair slippage choices shown in Settings: bps → label. */
export const SLIPPAGE_CHOICES: { bps: number; label: string }[] = SLIPPAGE_BPS_OPTIONS.map(bps => ({
  bps,
  label: `${bps / 100}%`,
}));

/** User-chosen slippage for volatile swap pairs (localStorage); default 5 bps. */
export const slippageBps = (): number => {
  try {
    const v = Number(localStorage.getItem(LS_KEY));
    return (SLIPPAGE_BPS_OPTIONS as readonly number[]).includes(v) ? v : DEFAULT_BPS;
  } catch {
    return DEFAULT_BPS;
  }
};

export const setSlippageBps = (bps: number) => {
  try {
    localStorage.setItem(LS_KEY, String(bps));
  } catch {
    /* storage blocked — session-only */
  }
};
