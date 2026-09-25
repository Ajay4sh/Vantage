import { describe, expect, it } from "vitest";
import { SCANNERS } from "../lib/scanners";
import type { ScanInput } from "../lib/scanners/types";
import type { Candle } from "../lib/types";

function candle(close: number, opts: { open?: number; volume?: number; high?: number; low?: number } = {}, i = 0): Candle {
  return {
    ts: `D${i}`,
    open: opts.open ?? close,
    high: opts.high ?? Math.max(close, opts.open ?? close),
    low: opts.low ?? Math.min(close, opts.open ?? close),
    close,
    volume: opts.volume ?? 100000,
  };
}

function stock(sym: string, candles: Candle[]): ScanInput {
  return { sym, name: sym, sector: "Test", candles };
}

describe("momentum scanner", () => {
  it("flags a stock that moved beyond the threshold over 5 sessions", () => {
    // 10 closes; close[4]=100, close[9]=112 → +12% over 5 sessions
    const closes = [95, 96, 98, 99, 100, 102, 105, 108, 110, 112];
    const mover = stock("MOVER", closes.map((c, i) => candle(c, {}, i)));
    const flat = stock("FLAT", new Array(10).fill(0).map((_, i) => candle(100, {}, i)));
    const matches = SCANNERS.momentum.run([mover, flat]);
    expect(matches.map((m) => m.sym)).toEqual(["MOVER"]);
    expect(matches[0].metric).toBeGreaterThanOrEqual(8);
  });
});

describe("volume scanner", () => {
  it("flags a volume spike above the 20-day average", () => {
    const bars = new Array(21).fill(0).map((_, i) => candle(100, { volume: 100000 }, i));
    bars[bars.length - 1] = candle(100, { volume: 400000 }, 20); // 4× average
    const matches = SCANNERS.volume.run([stock("SPIKE", bars)]);
    expect(matches).toHaveLength(1);
    expect(matches[0].metric).toBeGreaterThanOrEqual(2);
  });
});

describe("gap scanner", () => {
  it("flags a gap-up open vs the prior close", () => {
    const bars = [candle(100, {}, 0), candle(106, { open: 105 }, 1)]; // opened 5% above prev close
    const matches = SCANNERS.gap.run([stock("GAP", bars)]);
    expect(matches).toHaveLength(1);
    expect(matches[0].metric).toBeGreaterThanOrEqual(3);
  });
});

describe("52-week high/low scanner", () => {
  it("flags a stock closing near its range high", () => {
    const closes = new Array(60).fill(0).map((_, i) => 80 + i * 0.3); // steadily rising to the top
    const bars = closes.map((c, i) => candle(c, {}, i));
    const matches = SCANNERS.high_low.run([stock("NEARHI", bars)]);
    expect(matches).toHaveLength(1);
    expect(matches[0].detail).toMatch(/52-week high/);
  });
});

describe("golden/death cross scanner", () => {
  it("detects a golden cross at the end of a flat-then-rising series", () => {
    const closes = [...new Array(200).fill(100), 101, 103, 106, 110, 115];
    const bars = closes.map((c, i) => candle(c, {}, i));
    const matches = SCANNERS.cross.run([stock("GOLDEN", bars)]);
    expect(matches).toHaveLength(1);
    expect(matches[0].detail).toMatch(/golden cross/);
  });
});
