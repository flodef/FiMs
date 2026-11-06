import { neon } from "@neondatabase/serverless";
import type { TrackedKind, TrackedPosition } from "./types.js";

const url = process.env.DATABASE_URL;
const sql = url ? neon(url) : null;

export function dbReady(): boolean {
  return sql != null;
}

export const LASTGOOD_PREFIX = "lastGood:";
export const ALERT_STATE_KEY = "alert:state";

const kvGet = async (key: string): Promise<unknown | null> => {
  if (!sql) return null;
  const rows = await sql`select value::text as v from kv where key = ${key}`;
  const raw = rows[0]?.v;
  return typeof raw === "string" ? JSON.parse(raw) : null;
};

const kvSet = async (key: string, value: unknown): Promise<void> => {
  if (!sql) return;
  await sql`
    insert into kv (key, value) values (${key}, ${JSON.stringify(value)}::jsonb)
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `;
};

export async function getLastGood<T>(source: string): Promise<{ data: T; at: number } | null> {
  try {
    const parsed = (await kvGet(`${LASTGOOD_PREFIX}${source}`)) as { data?: T; at?: number } | T | null;
    if (parsed == null) return null;
    if (typeof parsed === "object" && "data" in parsed) return parsed as { data: T; at: number };
    return { data: parsed as T, at: Date.now() };
  } catch {
    return null;
  }
}

export async function setLastGood(source: string, data: unknown): Promise<void> {
  try {
    await kvSet(`${LASTGOOD_PREFIX}${source}`, { data, at: Date.now() });
  } catch {
    // best effort
  }
}

export async function pushSubsAll(): Promise<string[]> {
  if (!sql) return [];
  try {
    const rows = await sql`select subscription::text as s from push_subscriptions`;
    return rows.map(r => r.s).filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

const subEndpoint = (json: string): string | null => {
  try {
    const ep = (JSON.parse(json) as { endpoint?: unknown })?.endpoint;
    return typeof ep === "string" && ep ? ep : null;
  } catch {
    return null;
  }
};

export async function pushSubsAdd(json: string): Promise<void> {
  const endpoint = subEndpoint(json);
  if (!sql || !endpoint) return;
  try {
    await sql`
      insert into push_subscriptions (endpoint, subscription)
      values (${endpoint}, ${json}::jsonb)
      on conflict (endpoint) do update set subscription = excluded.subscription
    `;
  } catch {
    // best effort
  }
}

export async function pushSubsRemove(json: string): Promise<void> {
  const endpoint = subEndpoint(json);
  if (!sql || !endpoint) return;
  try {
    await sql`delete from push_subscriptions where endpoint = ${endpoint}`;
  } catch {
    // best effort
  }
}

export async function getAlertState<T>(): Promise<T | null> {
  try {
    return (await kvGet(ALERT_STATE_KEY)) as T | null;
  } catch {
    return null;
  }
}

export async function setAlertState(state: unknown): Promise<void> {
  try {
    await kvSet(ALERT_STATE_KEY, state);
  } catch {
    // best effort
  }
}

export interface TrackedInput {
  kind: TrackedKind;
  label?: string | null;
  platform?: string | null;
  wallet?: string | null;
  tokens?: string | null;
  asset?: string | null;
  amount?: number | null;
  apy?: number | null;
  unit?: string | null;
}

const txt = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export async function trackedList(): Promise<TrackedPosition[]> {
  if (!sql) return [];
  try {
    const rows = await sql`
      select id, kind, label, platform, wallet, tokens, asset, amount, apy, unit
      from tracked_positions order by id
    `;
    return rows as unknown as TrackedPosition[];
  } catch {
    return [];
  }
}

export async function trackedCreate(t: TrackedInput): Promise<number | null> {
  if (!sql) return null;
  const rows = await sql`
    insert into tracked_positions (kind, label, platform, wallet, tokens, asset, amount, apy, unit)
    values (${t.kind}, ${txt(t.label)}, ${txt(t.platform)}, ${txt(t.wallet)}, ${txt(t.tokens)}, ${txt(t.asset)},
            ${t.amount ?? null}, ${t.apy ?? null}, ${txt(t.unit)})
    returning id
  `;
  return (rows[0] as { id?: number } | undefined)?.id ?? null;
}

export async function trackedUpdate(id: number, t: TrackedInput): Promise<boolean> {
  if (!sql) return false;
  const rows = await sql`
    update tracked_positions set
      kind = ${t.kind}, label = ${txt(t.label)}, platform = ${txt(t.platform)},
      wallet = ${txt(t.wallet)}, tokens = ${txt(t.tokens)}, asset = ${txt(t.asset)},
      amount = ${t.amount ?? null}, apy = ${t.apy ?? null}, unit = ${txt(t.unit)},
      updated_at = now()
    where id = ${id}
    returning id
  `;
  return rows.length > 0;
}

export async function trackedDelete(id: number): Promise<boolean> {
  if (!sql) return false;
  const rows = await sql`delete from tracked_positions where id = ${id} returning id`;
  return rows.length > 0;
}
