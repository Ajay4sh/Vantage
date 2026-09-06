// Schema DDL, inlined so it bundles cleanly into serverless routes (reading
// db/schema.sql from disk isn't reliable in a Next build). Kept in sync with
// db/schema.sql, which stays the human-readable reference.

export const SCHEMA_SQL = `
create table if not exists users (
  id          uuid primary key,
  phone       text unique not null,
  created_at  timestamptz not null default now()
);
create table if not exists user_prefs (
  user_id     uuid primary key references users (id) on delete cascade,
  mode        text not null default 'pro',
  locale      text not null default 'en',
  watchlist   jsonb not null default '[]',
  capital     double precision,
  risk_pct    double precision not null default 2
);
alter table user_prefs add column if not exists capital double precision;
alter table user_prefs add column if not exists risk_pct double precision not null default 2;
create table if not exists alerts (
  id             uuid primary key,
  user_id        uuid not null references users (id) on delete cascade,
  symbol         text not null,
  condition_type text not null,
  threshold      double precision,
  note           text,
  created_at     timestamptz not null default now(),
  triggered_at   timestamptz,
  last_value     double precision
);
create index if not exists alerts_active_idx on alerts (triggered_at) where triggered_at is null;
create index if not exists alerts_user_idx on alerts (user_id);
create table if not exists notes (
  id          uuid primary key,
  user_id     uuid not null references users (id) on delete cascade,
  symbol      text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create table if not exists trade_log (
  id            uuid primary key,
  user_id       uuid not null references users (id) on delete cascade,
  symbol        text not null,
  strategy_type text not null,
  expiry_date   date,
  entry_price   double precision,
  exit_price    double precision,
  pnl           double precision,
  logged_at     timestamptz not null default now()
);
create index if not exists trade_log_user_idx on trade_log (user_id);
`;
