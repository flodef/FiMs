create table if not exists kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists tracked_positions (
  id serial primary key,
  kind text not null check (kind in ('manual','jupiter','kamino')),
  label text,
  platform text,
  wallet text,
  tokens text,
  asset text,
  amount double precision,
  apy double precision,
  unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
