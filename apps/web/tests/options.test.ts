import { describe, expect, it } from "vitest";
import { bsGreeks, buildOptionsAnalytics, computeMaxPain, realizedVol, synthesizeSmile } from "../lib/options";
import { parseOptionChain } from "../lib/upstox/client";
import type { ChainInput } from "../lib/options";

describe("bsGreeks", () => {
  const atm = bsGreeks({ spot: 100, strike: 100, ivPct: 20, dteDays: 30 });

  it("prices ATM call delta slightly above 0.5 (drift term)", () => {
    expect(atm.callDelta).toBeGreaterThan(0.5);
    expect(atm.callDelta).toBeLessThan(0.58);
  });

  it("respects put-call delta parity: callΔ − putΔ = 1", () => {
    expect(atm.callDelta - atm.putDelta).toBeCloseTo(1, 10);
  });

  it("produces positive gamma/vega and negative call theta", () => {
    expect(atm.gamma).toBeGreaterThan(0);
    expect(atm.vega).toBeGreaterThan(0);
    expect(atm.callTheta).toBeLessThan(0);
  });

  it("pushes deep ITM call delta toward 1", () => {
    const itm = bsGreeks({ spot: 100, strike: 60, ivPct: 20, dteDays: 30 });
    expect(itm.callDelta).toBeGreaterThan(0.98);
  });
});

describe("computeMaxPain", () => {
  it("finds the strike minimizing writers' payout", () => {
    // Hand-computed: payouts at 90/100/110 are 400/200/400.
    expect(computeMaxPain([90, 100, 110], [10, 20, 30], [30, 20, 10])).toBe(100);
  });

  it("is the middle strike for a symmetric chain", () => {
    expect(computeMaxPain([90, 100, 110], [10, 10, 10], [10, 10, 10])).toBe(100);
  });
});

describe("realizedVol", () => {
  it("is zero for a constant series", () => {
    expect(realizedVol(Array(25).fill(100))).toBe(0);
  });

  it("is null when history is too short to be meaningful", () => {
    expect(realizedVol([100, 101, 102])).toBeNull();
  });

  it("annualizes daily movement into a plausible range", () => {
    // ±1% alternating daily moves ≈ 16% annualized.
    const closes: number[] = [100];
    for (let i = 0; i < 24; i++) closes.push(closes[closes.length - 1] * (i % 2 === 0 ? 1.01 : 0.99));
    const rv = realizedVol(closes)!;
    expect(rv).toBeGreaterThan(10);
    expect(rv).toBeLessThan(25);
  });
});

describe("synthesizeSmile", () => {
  it("keeps ATM at the flat IV and richens wings, puts over calls", () => {
    const { callIV, putIV } = synthesizeSmile(30, [80, 90, 100, 110, 120], 100);
    expect(callIV[2]).toBe(30);
    expect(putIV[2]).toBe(30);
    expect(putIV[0]).toBeGreaterThan(30);
    expect(callIV[4]).toBeGreaterThan(30);
    expect(putIV[0]).toBeGreaterThan(callIV[0]);
  });
});

describe("buildOptionsAnalytics", () => {
  const base: ChainInput = {
    source: "sample",
    spot: 100,
    expiry: "2026-07-28",
    dte: 19,
    strikes: [90, 95, 100, 105, 110],
    callOI: [1000, 2000, 3000, 2000, 1000],
    putOI: [1200, 2400, 3600, 2400, 1200], // 1.2× puts → PCR 1.2
    callIV: [32, 31, 30, 31, 32],
    putIV: [36, 34, 30, 31, 32],
    closes: Array.from({ length: 25 }, (_, i) => 100 + Math.sin(i) * 0.5),
  };

  it("computes PCR, walls, and ATM IV from the chain", () => {
    const a = buildOptionsAnalytics(base);
    expect(a.pcr).toBe(1.2);
    expect(a.oiSupport).toBe(100);
    expect(a.oiResistance).toBe(100);
    expect(a.ivAtm).toBe(30);
    expect(a.greeks.some((g) => g.atm && g.strike === 100)).toBe(true);
  });

  it("emits all four signals with a bullish positioning read at PCR 1.2", () => {
    const a = buildOptionsAnalytics(base);
    expect(a.signals.map((s) => s.name)).toEqual(["Positioning", "Volatility pricing", "Max pain", "IV skew"]);
    const pos = a.signals[0];
    expect(pos.state).toBe("Bullish tilt");
    expect(pos.tone).toBe("pos");
    expect(a.score).toBeGreaterThan(0);
  });

  it("flags rich premium when IV dwarfs realized vol", () => {
    // ~0.5% oscillation → RV well under 10%; IV 30% is unambiguously rich.
    const a = buildOptionsAnalytics(base);
    const vol = a.signals.find((s) => s.name === "Volatility pricing")!;
    expect(vol.state).toBe("Rich");
  });

  it("reads put-heavy skew from the wings", () => {
    const skewed: ChainInput = { ...base, putIV: [40, 38, 30, 31, 32] };
    const a = buildOptionsAnalytics(skewed);
    const skew = a.signals.find((s) => s.name === "IV skew")!;
    expect(skew.state).toBe("Put-skewed");
  });

  it("stays neutral on a balanced chain", () => {
    const balanced: ChainInput = { ...base, putOI: [1000, 2000, 3000, 2000, 1000] };
    const a = buildOptionsAnalytics(balanced);
    expect(a.pcr).toBe(1);
    expect(a.signals[0].state).toBe("Neutral");
  });
});

describe("parseOptionChain", () => {
  const row = (strike: number, spot = 100) => ({
    expiry: "2026-07-28",
    strike_price: strike,
    underlying_spot_price: spot,
    call_options: { market_data: { oi: strike * 10 }, option_greeks: { iv: 30 } },
    put_options: { market_data: { oi: strike * 12 }, option_greeks: { iv: 33 } },
  });

  it("normalizes and sorts a valid chain", () => {
    const chain = parseOptionChain({ status: "success", data: [row(110), row(90), row(100), row(105)] });
    expect(chain.strikes).toEqual([90, 100, 105, 110]);
    expect(chain.spot).toBe(100);
    expect(chain.callOI[0]).toBe(900);
    expect(chain.putIV[0]).toBe(33);
  });

  it("trims wide chains to a window centered on ATM", () => {
    const rows = Array.from({ length: 41 }, (_, i) => row(60 + i * 2));
    const chain = parseOptionChain({ status: "success", data: rows }, 13);
    expect(chain.strikes).toHaveLength(13);
    // ATM (100) should be inside the window, roughly centered.
    expect(chain.strikes[0]).toBeLessThan(100);
    expect(chain.strikes[12]).toBeGreaterThan(100);
  });

  it("throws on shape drift or a truncated chain", () => {
    expect(() => parseOptionChain({ status: "error" })).toThrow(/shape changed/);
    expect(() => parseOptionChain({ status: "success", data: [] })).toThrow(/shape changed/);
    expect(() => parseOptionChain({ status: "success", data: [row(100)] })).toThrow(/expected a full chain/);
  });
});
