import { describe, expect, it } from "vitest";
import { buildTechnicals, classifyTrend, computeMACD, computeRSI, findSupportResistance, sma } from "../lib/technicals";
import type { Candle } from "../lib/types";

function candlesFromCloses(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    ts: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  }));
}

describe("sma", () => {
  it("averages the last N values", () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(sma([1, 2, 3, 4, 5], 2)).toBe(4.5);
  });

  it("averages everything when the series is shorter than the period", () => {
    expect(sma([2, 4], 10)).toBe(3);
  });
});

describe("computeRSI", () => {
  it("is 100 for a monotonically rising series", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(computeRSI(closes)).toBe(100);
  });

  it("is 50 for a flat series (no signal)", () => {
    expect(computeRSI(Array(30).fill(100))).toBe(50);
  });

  it("is 50 when the series is too short to compute", () => {
    expect(computeRSI([100, 101, 102])).toBe(50);
  });

  it("is low for a monotonically falling series", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 - i);
    expect(computeRSI(closes)).toBe(0);
  });
});

describe("computeMACD", () => {
  it("reads above the signal line in a fresh uptrend", () => {
    const closes = [...Array(40).fill(100), ...Array.from({ length: 20 }, (_, i) => 100 + (i + 1) * 2)];
    expect(computeMACD(closes).label).toBe("Above signal line");
  });

  it("reads below the signal line in a fresh downtrend", () => {
    const closes = [...Array(40).fill(100), ...Array.from({ length: 20 }, (_, i) => 100 - (i + 1) * 2)];
    expect(computeMACD(closes).label).toBe("Below signal line");
  });

  it("reports insufficient history for short series", () => {
    expect(computeMACD(Array(10).fill(100)).label).toBe("Insufficient history");
  });
});

describe("classifyTrend", () => {
  it("labels a rising series as an uptrend (conviction keys off 'up')", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
    expect(classifyTrend(closes).toLowerCase()).toContain("up");
  });

  it("labels a falling series as a downtrend (conviction keys off 'down')", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 200 - i);
    expect(classifyTrend(closes).toLowerCase()).toContain("down");
  });

  it("labels a flat series as sideways, containing neither 'up' nor 'down'", () => {
    const label = classifyTrend(Array(60).fill(100)).toLowerCase();
    expect(label).not.toContain("up");
    expect(label).not.toContain("down");
  });
});

describe("findSupportResistance", () => {
  it("finds swing lows below and swing highs above the last close", () => {
    // Repeating valley-90 / peak-110 cycle, ending at 100 (mid-range).
    const cycle = [100, 95, 90, 95, 100, 105, 110, 105];
    const closes = [...Array.from({ length: 8 }, () => cycle).flat(), 100];
    const { support, resistance } = findSupportResistance(candlesFromCloses(closes));
    // Candle lows/highs are close ∓1, so valleys bottom at 89 and peaks top at 111.
    expect(support[0]).toBe(89);
    expect(resistance[0]).toBe(111);
  });

  it("falls back to range extremes when there are no swings", () => {
    const { support, resistance } = findSupportResistance(candlesFromCloses(Array(40).fill(100)));
    expect(support).toEqual([99]);
    expect(resistance).toEqual([101]);
  });
});

describe("buildTechnicals", () => {
  it("assembles the full block from a synthetic series", () => {
    const closes = Array.from({ length: 120 }, (_, i) => 100 + i * 0.5 + Math.sin(i / 5) * 4);
    const t = buildTechnicals(candlesFromCloses(closes));
    expect(t.priceHistory).toHaveLength(20);
    expect(t.rsi).toBeGreaterThanOrEqual(0);
    expect(t.rsi).toBeLessThanOrEqual(100);
    expect(t.trend.toLowerCase()).toContain("up");
    expect(t.support.length).toBeGreaterThan(0);
    expect(t.resistance.length).toBeGreaterThan(0);
    expect(t.note).toContain("daily candles");
  });

  it("throws loudly on too-short history rather than emitting junk", () => {
    expect(() => buildTechnicals(candlesFromCloses(Array(10).fill(100)))).toThrow(/Not enough candle history/);
  });
});
