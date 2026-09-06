// Integration test for the Postgres-backed store. Runs the REAL schema against
// an in-process Postgres (PGlite) and exercises every store operation, so the
// SQL is genuinely verified — not just typechecked — without external infra.

import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { SCHEMA_SQL } from "../lib/db/schema";
import type { Queryable } from "../lib/db/client";
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
} from "../lib/store-pg";

let q: Queryable;

beforeAll(async () => {
  const pg = new PGlite();
  await pg.exec(SCHEMA_SQL);
  q = pg as unknown as Queryable;
});

describe("users", () => {
  it("creates a user, is idempotent by phone, and reads back", async () => {
    const u1 = await pgFindOrCreateUser(q, "+919800000001");
    expect(u1.phone).toBe("+919800000001");
    const u2 = await pgFindOrCreateUser(q, "+919800000001");
    expect(u2.id).toBe(u1.id); // idempotent
    const got = await pgGetUser(q, u1.id);
    expect(got?.phone).toBe("+919800000001");
    expect(await pgGetUser(q, "00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("prefs", () => {
  it("defaults then persists mode/locale/watchlist round-trip", async () => {
    const u = await pgFindOrCreateUser(q, "+919800000002");
    const def = await pgGetPrefs(q, u.id);
    expect(def).toEqual({ mode: "pro", locale: "en", watchlist: [], capital: null, riskPct: 2 });

    await pgSetPrefs(q, u.id, { mode: "simple", locale: "hi", watchlist: ["BPCL", "TCS"] });
    const after = await pgGetPrefs(q, u.id);
    expect(after.mode).toBe("simple");
    expect(after.locale).toBe("hi");
    expect(after.watchlist).toEqual(["BPCL", "TCS"]);

    // partial update keeps the rest
    await pgSetPrefs(q, u.id, { mode: "pro" });
    const merged = await pgGetPrefs(q, u.id);
    expect(merged.mode).toBe("pro");
    expect(merged.watchlist).toEqual(["BPCL", "TCS"]);
  });

  it("persists the Phase 9 capital + risk budget round-trip", async () => {
    const u = await pgFindOrCreateUser(q, "+919800000009");
    await pgSetPrefs(q, u.id, { capital: 100000, riskPct: 1.5 });
    const p = await pgGetPrefs(q, u.id);
    expect(p.capital).toBe(100000);
    expect(p.riskPct).toBe(1.5);
    // capital can be cleared back to null; risk budget survives partial update
    await pgSetPrefs(q, u.id, { capital: null });
    const cleared = await pgGetPrefs(q, u.id);
    expect(cleared.capital).toBeNull();
    expect(cleared.riskPct).toBe(1.5);
  });
});

describe("alerts", () => {
  it("creates, lists, triggers (leaves active), and deletes scoped to the user", async () => {
    const u = await pgFindOrCreateUser(q, "+919800000003");
    const other = await pgFindOrCreateUser(q, "+919800000004");

    const a = await pgCreateAlert(q, { userId: u.id, symbol: "BPCL", conditionType: "price_above", threshold: 300, note: null });
    expect(a.symbol).toBe("BPCL");
    expect(a.triggeredAt).toBeNull();

    const list = await pgListAlerts(q, u.id);
    expect(list).toHaveLength(1);

    const activeBefore = await pgListActiveAlerts(q);
    expect(activeBefore.some((x) => x.id === a.id)).toBe(true);

    await pgMarkAlertTriggered(q, a.id, 305.5);
    const activeAfter = await pgListActiveAlerts(q);
    expect(activeAfter.some((x) => x.id === a.id)).toBe(false);
    const triggered = (await pgListAlerts(q, u.id))[0];
    expect(triggered.triggeredAt).not.toBeNull();
    expect(triggered.lastValue).toBe(305.5);

    // another user can't delete it
    expect(await pgDeleteAlert(q, other.id, a.id)).toBe(false);
    expect(await pgDeleteAlert(q, u.id, a.id)).toBe(true);
    expect(await pgListAlerts(q, u.id)).toHaveLength(0);
  });
});

describe("notes", () => {
  it("saves and lists notes, filterable by symbol", async () => {
    const u = await pgFindOrCreateUser(q, "+919800000005");
    await pgSaveNote(q, u.id, "BPCL", "note one");
    await pgSaveNote(q, u.id, "TCS", "note two");
    expect(await pgListNotes(q, u.id)).toHaveLength(2);
    const bpcl = await pgListNotes(q, u.id, "BPCL");
    expect(bpcl).toHaveLength(1);
    expect(bpcl[0].body).toBe("note one");
  });
});

describe("trade log", () => {
  it("logs trades, lists them (filterable), and deletes scoped to the user", async () => {
    const u = await pgFindOrCreateUser(q, "+919800000006");
    const other = await pgFindOrCreateUser(q, "+919800000007");

    const t = await pgLogTrade(q, {
      userId: u.id,
      symbol: "BPCL",
      strategyType: "buy_call",
      expiryDate: "2026-09-25",
      entryPrice: 12.5,
      exitPrice: 4,
      pnl: -8.5,
    });
    expect(t.symbol).toBe("BPCL");
    expect(t.pnl).toBe(-8.5);
    expect(t.expiryDate).toBe("2026-09-25");

    await pgLogTrade(q, {
      userId: u.id,
      symbol: "TCS",
      strategyType: "sell_put",
      expiryDate: null,
      entryPrice: null,
      exitPrice: null,
      pnl: null, // still open
    });

    expect(await pgListTrades(q, u.id)).toHaveLength(2);
    const bpcl = await pgListTrades(q, u.id, "BPCL");
    expect(bpcl).toHaveLength(1);
    expect(bpcl[0].strategyType).toBe("buy_call");

    // another user can't delete it; owner can
    expect(await pgDeleteTrade(q, other.id, t.id)).toBe(false);
    expect(await pgDeleteTrade(q, u.id, t.id)).toBe(true);
    expect(await pgListTrades(q, u.id)).toHaveLength(1);
  });
});
