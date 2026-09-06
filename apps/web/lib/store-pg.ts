// Postgres-backed implementation of the user data store. Every function takes
// a `Queryable`, so the same code runs against a real pg.Pool in production and
// an in-process PGlite instance in tests (tests/store-pg.test.ts) — the SQL is
// genuinely exercised, not just typechecked.

import { randomUUID } from "node:crypto";
import type { Queryable } from "./db/client";
import type { Alert, AlertCondition, SavedNote, TradeLog, User, UserPrefs } from "./store";

const DEFAULT_PREFS: UserPrefs = {
  mode: "pro",
  locale: "en",
  watchlist: [],
  capital: null,
  riskPct: 2,
};

// ===== Users =====

export async function pgFindOrCreateUser(q: Queryable, phone: string): Promise<User> {
  const existing = await q.query("select id, phone, created_at from users where phone = $1", [phone]);
  if (existing.rows[0]) return rowToUser(existing.rows[0]);
  const id = randomUUID();
  const inserted = await q.query(
    "insert into users (id, phone) values ($1, $2) returning id, phone, created_at",
    [id, phone],
  );
  await q.query("insert into user_prefs (user_id) values ($1) on conflict do nothing", [id]);
  return rowToUser(inserted.rows[0]);
}

export async function pgGetUser(q: Queryable, id: string): Promise<User | null> {
  const res = await q.query("select id, phone, created_at from users where id = $1", [id]);
  return res.rows[0] ? rowToUser(res.rows[0]) : null;
}

// ===== Prefs =====

export async function pgGetPrefs(q: Queryable, userId: string): Promise<UserPrefs> {
  const res = await q.query(
    "select mode, locale, watchlist, capital, risk_pct from user_prefs where user_id = $1",
    [userId],
  );
  const row = res.rows[0];
  if (!row) return { ...DEFAULT_PREFS };
  return {
    mode: row.mode === "simple" ? "simple" : "pro",
    locale: row.locale === "hi" ? "hi" : "en",
    watchlist: Array.isArray(row.watchlist) ? (row.watchlist as string[]) : [],
    capital: row.capital == null ? null : Number(row.capital),
    riskPct: row.risk_pct == null ? 2 : Number(row.risk_pct),
  };
}

export async function pgSetPrefs(q: Queryable, userId: string, patch: Partial<UserPrefs>): Promise<UserPrefs> {
  const current = await pgGetPrefs(q, userId);
  const next = { ...current, ...patch };
  await q.query(
    `insert into user_prefs (user_id, mode, locale, watchlist, capital, risk_pct) values ($1, $2, $3, $4, $5, $6)
     on conflict (user_id) do update set mode = excluded.mode, locale = excluded.locale,
       watchlist = excluded.watchlist, capital = excluded.capital, risk_pct = excluded.risk_pct`,
    [userId, next.mode, next.locale, JSON.stringify(next.watchlist), next.capital, next.riskPct],
  );
  return next;
}

// ===== Alerts =====

export async function pgCreateAlert(
  q: Queryable,
  input: Omit<Alert, "id" | "createdAt" | "triggeredAt" | "lastValue">,
): Promise<Alert> {
  const id = randomUUID();
  const res = await q.query(
    `insert into alerts (id, user_id, symbol, condition_type, threshold, note)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [id, input.userId, input.symbol, input.conditionType, input.threshold, input.note],
  );
  return rowToAlert(res.rows[0]);
}

export async function pgListAlerts(q: Queryable, userId: string): Promise<Alert[]> {
  const res = await q.query("select * from alerts where user_id = $1 order by created_at desc", [userId]);
  return res.rows.map(rowToAlert);
}

export async function pgListActiveAlerts(q: Queryable): Promise<Alert[]> {
  const res = await q.query("select * from alerts where triggered_at is null");
  return res.rows.map(rowToAlert);
}

export async function pgMarkAlertTriggered(q: Queryable, id: string, value: number): Promise<void> {
  await q.query("update alerts set triggered_at = now(), last_value = $2 where id = $1", [id, value]);
}

export async function pgDeleteAlert(q: Queryable, userId: string, id: string): Promise<boolean> {
  const res = await q.query("delete from alerts where id = $1 and user_id = $2 returning id", [id, userId]);
  return res.rows.length > 0;
}

// ===== Notes =====

export async function pgSaveNote(q: Queryable, userId: string, symbol: string, body: string): Promise<SavedNote> {
  const id = randomUUID();
  const res = await q.query(
    "insert into notes (id, user_id, symbol, body) values ($1, $2, $3, $4) returning *",
    [id, userId, symbol, body],
  );
  return rowToNote(res.rows[0]);
}

export async function pgListNotes(q: Queryable, userId: string, symbol?: string): Promise<SavedNote[]> {
  const res = symbol
    ? await q.query("select * from notes where user_id = $1 and symbol = $2 order by created_at desc", [userId, symbol])
    : await q.query("select * from notes where user_id = $1 order by created_at desc", [userId]);
  return res.rows.map(rowToNote);
}

// ===== Trade log =====

export async function pgLogTrade(
  q: Queryable,
  input: Omit<TradeLog, "id" | "loggedAt">,
): Promise<TradeLog> {
  const id = randomUUID();
  const res = await q.query(
    `insert into trade_log (id, user_id, symbol, strategy_type, expiry_date, entry_price, exit_price, pnl)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
    [
      id,
      input.userId,
      input.symbol,
      input.strategyType,
      input.expiryDate,
      input.entryPrice,
      input.exitPrice,
      input.pnl,
    ],
  );
  return rowToTrade(res.rows[0]);
}

export async function pgListTrades(q: Queryable, userId: string, symbol?: string): Promise<TradeLog[]> {
  const res = symbol
    ? await q.query(
        "select * from trade_log where user_id = $1 and symbol = $2 order by logged_at desc",
        [userId, symbol],
      )
    : await q.query("select * from trade_log where user_id = $1 order by logged_at desc", [userId]);
  return res.rows.map(rowToTrade);
}

export async function pgDeleteTrade(q: Queryable, userId: string, id: string): Promise<boolean> {
  const res = await q.query("delete from trade_log where id = $1 and user_id = $2 returning id", [id, userId]);
  return res.rows.length > 0;
}

// ===== Row mappers =====

function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function rowToUser(r: Record<string, unknown>): User {
  return { id: String(r.id), phone: String(r.phone), createdAt: iso(r.created_at) };
}

function rowToAlert(r: Record<string, unknown>): Alert {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    symbol: String(r.symbol),
    conditionType: String(r.condition_type) as AlertCondition,
    threshold: r.threshold == null ? null : Number(r.threshold),
    note: r.note == null ? null : String(r.note),
    createdAt: iso(r.created_at),
    triggeredAt: r.triggered_at == null ? null : iso(r.triggered_at),
    lastValue: r.last_value == null ? null : Number(r.last_value),
  };
}

function rowToNote(r: Record<string, unknown>): SavedNote {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    symbol: String(r.symbol),
    body: String(r.body),
    createdAt: iso(r.created_at),
  };
}

function dateStr(v: unknown): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

function rowToTrade(r: Record<string, unknown>): TradeLog {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    symbol: String(r.symbol),
    strategyType: String(r.strategy_type),
    expiryDate: dateStr(r.expiry_date),
    entryPrice: r.entry_price == null ? null : Number(r.entry_price),
    exitPrice: r.exit_price == null ? null : Number(r.exit_price),
    pnl: r.pnl == null ? null : Number(r.pnl),
    loggedAt: iso(r.logged_at),
  };
}
