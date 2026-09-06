import { describe, expect, it } from "vitest";
import { bsPrice } from "../lib/options";
import {
  buildReflection,
  capitalAtRiskPct,
  computeMirrorStats,
  computePositionRisk,
  computeSizing,
  isExpiryDayTrade,
  sizeMultiple,
  type AggStat,
} from "../lib/risk";
import type { TradeLog } from "../lib/store";

const base = { strike: 100, premium: 5, lotSize: 50, contracts: 2, spot: 100 };

describe("computePositionRisk", () => {
  it("long call: defined risk = premium paid, breakeven strike+premium, unbounded upside", () => {
    const r = computePositionRisk({ ...base, side: "buy_call" });
    expect(r.definedRisk).toBe(true);
    expect(r.isShort).toBe(false);
    expect(r.maxLoss).toBe(500); // 5 × 50 × 2
    expect(r.maxLossUnbounded).toBe(false);
    expect(r.breakeven).toBe(105);
    expect(r.maxProfitUnbounded).toBe(true);
    expect(r.maxProfit).toBeNull();
  });

  it("long put: defined risk, breakeven strike-premium, bounded upside", () => {
    const r = computePositionRisk({ ...base, side: "buy_put" });
    expect(r.definedRisk).toBe(true);
    expect(r.maxLoss).toBe(500);
    expect(r.breakeven).toBe(95);
    expect(r.maxProfit).toBe((100 - 5) * 100); // (strike-premium) × 100 shares
    expect(r.maxProfitUnbounded).toBe(false);
  });

  it("naked short call: undefined risk, unbounded loss, keeps premium as max profit", () => {
    const r = computePositionRisk({ ...base, side: "sell_call" });
    expect(r.definedRisk).toBe(false);
    expect(r.isShort).toBe(true);
    expect(r.maxLoss).toBeNull();
    expect(r.maxLossUnbounded).toBe(true);
    expect(r.breakeven).toBe(105);
    expect(r.maxProfit).toBe(500); // premium collected
  });

  it("naked short put: undefined risk flagged, loss bounded but large (strike-premium)×shares", () => {
    const r = computePositionRisk({ ...base, side: "sell_put" });
    expect(r.definedRisk).toBe(false);
    expect(r.maxLossUnbounded).toBe(false);
    expect(r.maxLoss).toBe((100 - 5) * 100);
    expect(r.breakeven).toBe(95);
    expect(r.maxProfit).toBe(500);
  });
});

describe("capitalAtRiskPct", () => {
  it("expresses max loss as a % of capital", () => {
    expect(capitalAtRiskPct(500, 100000)).toBe(0.5);
    expect(capitalAtRiskPct(2000, 100000)).toBe(2);
  });
  it("returns null for unbounded loss or unset/zero capital", () => {
    expect(capitalAtRiskPct(null, 100000)).toBeNull();
    expect(capitalAtRiskPct(500, null)).toBeNull();
    expect(capitalAtRiskPct(500, 0)).toBeNull();
  });
});

describe("computeSizing + sizeMultiple", () => {
  it("suggests whole contracts that fit the risk budget", () => {
    // budget = 100000 × 2% = 2000; per-contract premium = 5 × 50 = 250 → 8 lots
    const s = computeSizing({ capital: 100000, riskPct: 2, perContractPremium: 250 });
    expect(s.maxRiskAmount).toBe(2000);
    expect(s.suggestedContracts).toBe(8);
  });
  it("reports how oversized the entered position is", () => {
    expect(sizeMultiple(24, 8)).toBe(3); // 3× the suggested size
    expect(sizeMultiple(4, 8)).toBe(0.5);
    expect(sizeMultiple(4, 0)).toBeNull(); // nothing to compare against
  });
});

describe("bsPrice", () => {
  it("prices an ATM call above zero and rising with volatility", () => {
    const lowVol = bsPrice(100, 100, 15, 30, "call");
    const highVol = bsPrice(100, 100, 40, 30, "call");
    expect(lowVol).toBeGreaterThan(0);
    expect(highVol).toBeGreaterThan(lowVol);
  });
  it("a deep OTM option is nearly worthless", () => {
    expect(bsPrice(100, 200, 20, 7, "call")).toBeLessThan(0.5);
  });
});

// ----- trade-log aggregation -----

function trade(p: Partial<TradeLog>): TradeLog {
  return {
    id: Math.random().toString(36).slice(2),
    userId: "u",
    symbol: "X",
    strategyType: "buy_call",
    expiryDate: null,
    entryPrice: null,
    exitPrice: null,
    pnl: null,
    loggedAt: "2026-09-01T10:00:00.000Z",
    ...p,
  };
}

describe("computeMirrorStats", () => {
  it("computes win rate and P&L over closed trades only, split by buyer/seller", () => {
    const trades = [
      trade({ strategyType: "buy_call", pnl: -100 }),
      trade({ strategyType: "buy_put", pnl: 50 }),
      trade({ strategyType: "sell_put", pnl: 200 }),
      trade({ strategyType: "buy_call", pnl: null }), // open, excluded from win rate
    ];
    const s = computeMirrorStats(trades);
    expect(s.overall.count).toBe(4);
    expect(s.overall.winRate).toBe(66.7); // 2 wins of 3 closed
    expect(s.overall.totalPnl).toBe(150);
    expect(s.buyers.count).toBe(3);
    expect(s.buyers.winRate).toBe(50); // 1 win of 2 closed buyer trades
    expect(s.sellers.count).toBe(1);
    expect(s.sellers.winRate).toBe(100);
  });

  it("flags expiry-day trades by logged_at == expiry_date", () => {
    const expiryDay = trade({ expiryDate: "2026-09-01", loggedAt: "2026-09-01T14:00:00.000Z", pnl: -300 });
    const swing = trade({ expiryDate: "2026-09-25", loggedAt: "2026-09-01T14:00:00.000Z", pnl: 100 });
    expect(isExpiryDayTrade(expiryDay)).toBe(true);
    expect(isExpiryDayTrade(swing)).toBe(false);
    const s = computeMirrorStats([expiryDay, swing]);
    expect(s.expiryDay.count).toBe(1);
    expect(s.expiryDay.totalPnl).toBe(-300);
    expect(s.swing.count).toBe(1);
  });
});

describe("buildReflection", () => {
  const emptyStats: AggStat = { count: 0, wins: 0, winRate: null, totalPnl: 0, avgPnl: null };

  it("stays silent when the position is not same-day expiry", () => {
    const r = buildReflection({
      sameDayExpiry: false,
      capitalRiskPct: 10,
      riskBudgetPct: 2,
      enteredContracts: 5,
      suggestedContracts: 1,
      expiryDayStats: emptyStats,
    });
    expect(r.show).toBe(false);
  });

  it("falls back to the SEBI finding when there's no personal history", () => {
    const r = buildReflection({
      sameDayExpiry: true,
      capitalRiskPct: 1,
      riskBudgetPct: 2,
      enteredContracts: 1,
      suggestedContracts: 3,
      expiryDayStats: emptyStats,
    });
    expect(r.show).toBe(true);
    expect(r.oversized).toBe(false);
    expect(r.message).toMatch(/same-day-expiry/i);
  });

  it("uses personal expiry-day history and flags oversized positions", () => {
    const stats: AggStat = { count: 4, wins: 1, winRate: 25, totalPnl: -4000, avgPnl: -1000 };
    const r = buildReflection({
      sameDayExpiry: true,
      capitalRiskPct: 8,
      riskBudgetPct: 2,
      enteredContracts: 5,
      suggestedContracts: 1,
      expiryDayStats: stats,
    });
    expect(r.show).toBe(true);
    expect(r.oversized).toBe(true); // over budget and over suggested size
    expect(r.message).toMatch(/expiry-day trades averaged/i);
    expect(r.message).toMatch(/loss/i);
  });
});
