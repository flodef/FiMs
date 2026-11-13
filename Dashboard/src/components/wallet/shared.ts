import type { PlanStage, RebalancePlan } from "../../lib/rebalance/plan";

export const STAGE_LABEL: Record<PlanStage["type"], string> = {
  lend: "Jupiter Lend",
  "kamino-withdraw": "Kamino withdraw",
  swap: "Swap",
  "kamino-deposit": "Kamino deposit",
  "spend-transfer": "Card transfer",
};

export type StageStatus =
  "pending" | "building" | "simulated" | "awaiting signature" | "sending" | "confirming" | "confirmed" | "failed";

export interface StageState {
  status: StageStatus;
  sig?: string;
  error?: string;
  /** signed tx still awaiting confirmation — checked via `status` on Resume */
  pendingTx?: string;
  /** index of pendingTx within the stage's tx list */
  pendingIdx?: number;
  /** total txs in the stage when pendingTx was sent */
  pendingCount?: number;
}

export interface SavedRun {
  plan: RebalancePlan;
  states: StageState[];
  startedAt: number;
}

export const b64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const bytesToB64 = (bytes: Uint8Array): string => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

export const api = async (body: Record<string, unknown>) => {
  const res = await fetch("/api/rebalance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
};

export const short = (a: string) => (a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);
