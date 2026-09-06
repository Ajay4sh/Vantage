import { afterEach, describe, expect, it, vi } from "vitest";
import { computeConviction, computeImpliedMove, generateNote } from "../lib/conviction";
import { SAMPLE_STOCKS } from "../lib/sample-data";
import type { Stock } from "../lib/types";

describe("computeConviction", () => {
  it("matches the demo's scoring for BPCL (regression against the port)", () => {
    const conv = computeConviction(SAMPLE_STOCKS.BPCL);
    // revGrowth -3.1 → -20, roe 14.2 → 0; trend contains "down" → -25, rsi 47 → 0;
    // pcr 0.94 → round(-3.6) = -4; news 1 pos / 1 neg → 0. Average of -49/4 → -12.
    expect(conv.drivers.map((d) => d.score)).toEqual([-20, -25, -4, 0]);
    expect(conv.score).toBe(-12);
  });

  it("matches the demo's scoring for TCS", () => {
    const conv = computeConviction(SAMPLE_STOCKS.TCS);
    // +20 rev, +15 roe; "Sideways-to-up" → +25; pcr 1.04 → +2; 1 pos news → +15.
    expect(conv.drivers.map((d) => d.score)).toEqual([35, 25, 2, 15]);
    expect(conv.score).toBe(19);
  });

  it("treats null fundamentals as no-signal instead of coercing them", () => {
    const s: Stock = JSON.parse(JSON.stringify(SAMPLE_STOCKS.BPCL));
    s.fundamentals.revGrowth = null;
    s.fundamentals.roe = null;
    const conv = computeConviction(s);
    expect(conv.drivers[0].score).toBe(0);
  });
});

describe("computeImpliedMove", () => {
  afterEach(() => vi.useRealTimers());

  it("computes Price × IV × √(DTE/365) bands for BPCL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T04:30:00Z")); // 10:00 IST
    const m = computeImpliedMove(SAMPLE_STOCKS.BPCL);
    expect(m.dte).toBe(19);
    // 305 × 0.385 × √(19/365) ≈ 26.79
    expect(m.oneSD).toBeCloseTo(26.79, 1);
    expect(m.range68[0]).toBeCloseTo(305 - m.oneSD, 6);
    expect(m.range95[1]).toBeCloseTo(305 + 2 * m.oneSD, 6);
  });

  it("floors DTE at 1 so expired chains never divide to zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-01T00:00:00Z"));
    expect(computeImpliedMove(SAMPLE_STOCKS.BPCL).dte).toBe(1);
  });
});

describe("generateNote", () => {
  it("always carries the compliance disclaimer", () => {
    const note = generateNote(SAMPLE_STOCKS.BPCL);
    expect(note).toContain("RESEARCH NOTE — BPCL");
    expect(note).toContain("Not investment advice. Not SEBI-registered research.");
  });

  it("prints n/a for metrics the live API doesn't provide", () => {
    const s: Stock = JSON.parse(JSON.stringify(SAMPLE_STOCKS.BPCL));
    s.fundamentals.divYield = null;
    s.fundamentals.revGrowth = null;
    const note = generateNote(s);
    expect(note).toContain("Rev growth n/a");
    expect(note).toContain("Div yield n/a");
  });
});
