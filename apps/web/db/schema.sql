-- Vantage Postgres schema. The app runs on an in-memory store (lib/store.ts)
-- until DATABASE_URL is set; this file is the reference schema a Postgres
-- implementation of that store maps onto (Phase 5 notes + Phase 8.2 alerts).

create table if not exists users (
  id          uuid primary key,
  phone       text unique not null,
  created_at  timestamptz not null default now()
);

create table if not exists user_prefs (
  user_id     uuid primary key references users (id) on delete cascade,
  mode        text not null default 'pro',   -- 'simple' | 'pro'
  locale      text not null default 'en',    -- 'en' | 'hi'
  watchlist   jsonb not null default '[]',
  capital     double precision,              -- Phase 9: stated trading capital (₹)
  risk_pct    double precision not null default 2  -- Phase 9: per-trade risk budget (%)
);

-- Phase 8.2 — price/event alerts
create table if not exists alerts (
  id             uuid primary key,
  user_id        uuid not null references users (id) on delete cascade,
  symbol         text not null,
  condition_type text not null,   -- price_above | price_below | cross_support |
                                  -- cross_resistance | iv_spike | 52w_high |
                                  -- 52w_low | pcr_shift
  threshold      double precision,
  note           text,
  created_at     timestamptz not null default now(),
  triggered_at   timestamptz,
  last_value     double precision
);

create index if not exists alerts_active_idx on alerts (triggered_at) where triggered_at is null;
create index if not exists alerts_user_idx on alerts (user_id);

-- Phase 5 — saved research notes
create table if not exists notes (
  id          uuid primary key,
  user_id     uuid not null references users (id) on delete cascade,
  symbol      text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- Phase 9 — self-logged trade journal (raw data for the private loss-pattern
-- mirror). Self-reported for now; broker-linked import is out of scope.
create table if not exists trade_log (
  id            uuid primary key,
  user_id       uuid not null references users (id) on delete cascade,
  symbol        text not null,
  strategy_type text not null,   -- buy_call | buy_put | sell_call | sell_put |
                                 -- covered_call | credit_spread | other
  expiry_date   date,
  entry_price   double precision,
  exit_price    double precision,
  pnl           double precision, -- ₹; null while the trade is open
  logged_at     timestamptz not null default now()
);
create index if not exists trade_log_user_idx on trade_log (user_id);
