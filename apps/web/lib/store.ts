// Persistence layer for user-scoped data: accounts, watchlists, saved notes,
// alerts, and per-user preferences (Simple/Pro mode, locale).
//
// Mirrors the cache.ts philosophy — real backend when configured, zero-infra
// fallback otherwise. Here that's Postgres when DATABASE_URL is set, else an
// in-process store so local dev and the credential-free demo just work. The
// in-memory store is per-instance and non-durable; that's fine for the demo,
// and the interface is shaped so a Postgres implementation drops in behind it
// (see db/schema.sql for the tables).

import { randomUUID } from "node:crypto";
import { db } from "./db/client";
import {
  pgCreateAlert,
  pgDeleteAlert,
  pgDeleteTrade,
  pgFindOrCreateUser,
  pgGetPrefs,
  pgGetUser,
  pgListActiveAlerts,
  pgListAlerts,
  pgListNotes,
  pgListTrades,
  pgLogTrade,
  pgMarkAlertTriggered,
  pgSaveNote,
  pgSetPrefs,
} from "./store-pg";

export type Mode = "simple" | "pro";
export type Locale = "en" | "hi";

export interface User {
  id: string;
  phone: string; // E.164, e.g. +919876543210
  createdAt: string;
}

export interface UserPrefs {
  mode: Mode;
  locale: Locale;
  watchlist: string[];
  // Phase 9 — the "denominator that makes every risk number meaningful":
  // stated trading capital (₹) and the per-trade risk budget (%). capital is
  // null until the user sets it once; riskPct defaults to 2%.
  capital: number | null;
  riskPct: number;
}

export type AlertCondition =
  | "price_above"
  | "price_below"
  | "cross_support"
  | "cross_resistance"
  | "iv_spike"
  | "52w_high"
  | "52w_low"
  | "pcr_shift";

export interface Alert {
  id: string;
  userId: string;
  symbol: string;
  conditionType: AlertCondition;
  threshold: number | null;
  note: string | null;
  createdAt: string;
  triggeredAt: string | null;
  lastValue: number | null;
}

export interface SavedNote {
  id: string;
  userId: string;
  symbol: string;
  body: string;
  createdAt: string;
}

// Phase 9 — self-logged trade journal, the raw material for the private
// loss-pattern mirror. MVP is self-reported; broker-linked auto-import is out
// of scope. entryPrice/exitPrice/pnl are per the user's own record.
export interface TradeLog {
  id: string;
  userId: string;
  symbol: string;
  strategyType: string; // buy_call | buy_put | sell_call | sell_put | covered_call | credit_spread | other
  expiryDate: string | null; // ISO date of the option expiry, if applicable
  entryPrice: number | null;
  exitPrice: number | null;
  pnl: number | null; // ₹; null while the trade is still open
  loggedAt: string;
}

interface MemStore {
  users: Map<string, User>; // id -> user
  usersByPhone: Map<string, string>; // phone -> id
  prefs: Map<string, UserPrefs>; // userId -> prefs
  alerts: Map<string, Alert>; // alertId -> alert
  notes: Map<string, SavedNote>; // noteId -> note
  trades: Map<string, TradeLog>; // tradeId -> trade
  otps: Map<string, { code: string; expires: number; attempts: number }>; // phone -> otp
}

const g = globalThis as unknown as { __vantageStore?: MemStore };
const mem = (g.__vantageStore ??= {
  users: new Map(),
  usersByPhone: new Map(),
  prefs: new Map(),
  alerts: new Map(),
  notes: new Map(),
  trades: new Map(),
  otps: new Map(),
});

const DEFAULT_PREFS: UserPrefs = {
  mode: "pro",
  locale: "en",
  watchlist: [],
  capital: null,
  riskPct: 2,
};

// ===== OTP (always in-memory: ephemeral, no reason to persist) =====

export function putOtp(phone: string, code: string, ttlSeconds: number): void {
  mem.otps.set(phone, { code, expires: Date.now() + ttlSeconds * 1000, attempts: 0 });
}

/** Returns "ok" | "expired" | "mismatch" | "too_many". Consumes on success. */
export function checkOtp(phone: string, code: string): "ok" | "expired" | "mismatch" | "too_many" {
  const entry = mem.otps.get(phone);
  if (!entry || entry.expires < Date.now()) {
    mem.otps.delete(phone);
    return "expired";
  }
  if (entry.attempts >= 5) {
    mem.otps.delete(phone);
    return "too_many";
  }
  if (entry.code !== code) {
    entry.attempts += 1;
    return "mismatch";
  }
  mem.otps.delete(phone);
  return "ok";
}

// ===== Users =====
// Each function persists to Postgres when DATABASE_URL is set (durable across
// restarts), else to the per-instance in-memory maps (non-durable demo).

export async function findOrCreateUser(phone: string): Promise<User> {
  const q = await db();
  if (q) return pgFindOrCreateUser(q, phone);
  const existingId = mem.usersByPhone.get(phone);
  if (existingId) return mem.users.get(existingId)!;
  const user: User = { id: randomUUID(), phone, createdAt: new Date().toISOString() };
  mem.users.set(user.id, user);
  mem.usersByPhone.set(phone, user.id);
  mem.prefs.set(user.id, { ...DEFAULT_PREFS });
  return user;
}

export async function getUser(id: string): Promise<User | null> {
  const q = await db();
  if (q) return pgGetUser(q, id);
  return mem.users.get(id) ?? null;
}

// ===== Prefs =====

export async function getPrefs(userId: string): Promise<UserPrefs> {
  const q = await db();
  if (q) return pgGetPrefs(q, userId);
  return mem.prefs.get(userId) ?? { ...DEFAULT_PREFS };
}

export async function setPrefs(userId: string, patch: Partial<UserPrefs>): Promise<UserPrefs> {
  const q = await db();
  if (q) return pgSetPrefs(q, userId, patch);
  const next = { ...(mem.prefs.get(userId) ?? DEFAULT_PREFS), ...patch };
  mem.prefs.set(userId, next);
  return next;
}

// ===== Alerts =====

export async function createAlert(
  input: Omit<Alert, "id" | "createdAt" | "triggeredAt" | "lastValue">,
): Promise<Alert> {
  const q = await db();
  if (q) return pgCreateAlert(q, input);
  const alert: Alert = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    triggeredAt: null,
    lastValue: null,
  };
  mem.alerts.set(alert.id, alert);
  return alert;
}

export async function listAlerts(userId: string): Promise<Alert[]> {
  const q = await db();
  if (q) return pgListAlerts(q, userId);
  return Array.from(mem.alerts.values())
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listActiveAlerts(): Promise<Alert[]> {
  const q = await db();
  if (q) return pgListActiveAlerts(q);
  return Array.from(mem.alerts.values()).filter((a) => a.triggeredAt === null);
}

export async function markAlertTriggered(id: string, value: number): Promise<void> {
  const q = await db();
  if (q) return pgMarkAlertTriggered(q, id, value);
  const a = mem.alerts.get(id);
  if (a) {
    a.triggeredAt = new Date().toISOString();
    a.lastValue = value;
  }
}

export async function deleteAlert(userId: string, id: string): Promise<boolean> {
  const q = await db();
  if (q) return pgDeleteAlert(q, userId, id);
  const a = mem.alerts.get(id);
  if (a && a.userId === userId) return mem.alerts.delete(id);
  return false;
}

// ===== Saved notes =====

export async function saveNote(userId: string, symbol: string, body: string): Promise<SavedNote> {
  const q = await db();
  if (q) return pgSaveNote(q, userId, symbol, body);
  const note: SavedNote = { id: randomUUID(), userId, symbol, body, createdAt: new Date().toISOString() };
  mem.notes.set(note.id, note);
  return note;
}

export async function listNotes(userId: string, symbol?: string): Promise<SavedNote[]> {
  const q = await db();
  if (q) return pgListNotes(q, userId, symbol);
  return Array.from(mem.notes.values())
    .filter((n) => n.userId === userId && (!symbol || n.symbol === symbol))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ===== Trade log (Phase 9) =====

export async function logTrade(
  input: Omit<TradeLog, "id" | "loggedAt">,
): Promise<TradeLog> {
  const q = await db();
  if (q) return pgLogTrade(q, input);
  const trade: TradeLog = { ...input, id: randomUUID(), loggedAt: new Date().toISOString() };
  mem.trades.set(trade.id, trade);
  return trade;
}

export async function listTrades(userId: string, symbol?: string): Promise<TradeLog[]> {
  const q = await db();
  if (q) return pgListTrades(q, userId, symbol);
  return Array.from(mem.trades.values())
    .filter((t) => t.userId === userId && (!symbol || t.symbol === symbol))
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
}

export async function deleteTrade(userId: string, id: string): Promise<boolean> {
  const q = await db();
  if (q) return pgDeleteTrade(q, userId, id);
  const t = mem.trades.get(id);
  if (t && t.userId === userId) return mem.trades.delete(id);
  return false;
}

export function storageBackend(): "postgres" | "memory" {
  return process.env.DATABASE_URL ? "postgres" : "memory";
}
