import { describe, expect, it } from "vitest";
import { buildStrategy, legPayoff, type StrategyLeg } from "../lib/options/strategyBuilder";

const call = (side: "buy" | "sell", strike: number, premium: number, qty = 1, lotSize = 1): StrategyLeg => ({ type: "call", side, strike, premium, qty, lotSize });
const put = (side: "buy" | "sell", strike: number, premium: number, qty = 1, lotSize = 1): StrategyLeg => ({ type: "put", side, strike, premium, qty, lotSize });

describe("legPayoff", () => {
  it("prices a long call payoff net of premium, scaled by shares", () => {
    // buy 100 call @5, 2 lots × 50 = 100 shares, at S=110 → intrinsic 10, net 5 → 500
    expect(legPayoff(call("buy", 100, 5, 2, 50), 110)).toBe(500);
    // below strike → lose the premium
    expect(legPayoff(call("buy", 100, 5, 2, 50), 90)).toBe(-500);
  });
});

describe("buildStrategy — bull call spread", () => {
  const r = buildStrategy([call("buy", 100, 5), call("sell", 110, 2)], 100);
  it("is defined-risk with capped profit and loss", () => {
    expect(r.definedRisk).toBe(true);
    expect(r.maxLossUnbounded).toBe(false);
    expect(r.maxProfitUnbounded).toBe(false);
    expect(r.maxLoss).toBeCloseTo(-3, 1); // net debit
    expect(r.maxProfit).toBeCloseTo(7, 1); // width 10 − debit 3
    expect(r.netPremium).toBeCloseTo(-3, 5); // net debit paid
  });
  it("breaks even around strike + net debit", () => {
    expect(r.breakevens.some((b) => Math.abs(b - 103) < 1)).toBe(true);
  });
});

describe("buildStrategy — long straddle", () => {
  const r = buildStrategy([call("buy", 100, 5), put("buy", 100, 5)], 100);
  it("has unbounded upside profit but a defined, premium-sized max loss", () => {
    expect(r.maxProfitUnbounded).toBe(true);
    expect(r.definedRisk).toBe(true);
    expect(r.maxLoss).toBeCloseTo(-10, 1); // both premiums, at the strike
    expect(r.breakevens.some((b) => Math.abs(b - 90) < 1.5)).toBe(true);
    expect(r.breakevens.some((b) => Math.abs(b - 110) < 1.5)).toBe(true);
  });
});

describe("buildStrategy — short straddle", () => {
  const r = buildStrategy([call("sell", 100, 5), put("sell", 100, 5)], 100);
  it("is flagged undefined-risk with unbounded loss", () => {
    expect(r.maxLossUnbounded).toBe(true);
    expect(r.definedRisk).toBe(false);
    expect(r.maxLoss).toBeNull();
    expect(r.maxProfit).toBeCloseTo(10, 1); // keeps both premiums at the strike
  });
});

describe("buildStrategy — covered call", () => {
  const r = buildStrategy(
    [
      { type: "stock", side: "buy", strike: 100, premium: 0, qty: 1, lotSize: 1 },
      call("sell", 110, 3),
    ],
    100,
  );
  it("caps upside and is defined-risk (loss bounded as stock falls to zero)", () => {
    expect(r.definedRisk).toBe(true);
    expect(r.maxProfitUnbounded).toBe(false);
    expect(r.maxProfit).toBeCloseTo(13, 1); // (110−100) gain + 3 premium
  });
});
