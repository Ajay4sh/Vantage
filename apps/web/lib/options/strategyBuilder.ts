// Phase 12 (Gap 3) — multi-leg options strategy builder. SIMULATION ONLY: it
// computes the combined expiry payoff of a set of legs and the risk figures
// around it. No execution — this feeds the Phase 9 Pre-trade Risk Gate framing,
// it does not become a "click to trade" flow.
//
// Deliberate difference from typical strategy builders: max loss and whether
// risk is defined or undefined are computed as first-class outputs, surfaced by
// the UI as prominently as max profit (Phase 9 / Phase 12 guardrail).

import { bsPrice } from "./core";

export type OptType = "call" | "put" | "stock";
export type LegSide = "buy" | "sell";

export interface StrategyLeg {
  type: OptType;
  side: LegSide;
  strike: number; // for a "stock" leg this is the entry price
  premium: number; // per share; 0 for a stock leg
  qty: number; // number of lots
  lotSize: number;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Payoff of a single leg at underlying price S at expiry, in ₹ (whole leg). */
export function legPayoff(leg: StrategyLeg, S: number): number {
  const shares = leg.qty * leg.lotSize;
  if (leg.type === "stock") {
    const perShare = (leg.side === "buy" ? 1 : -1) * (S - leg.strike);
    return perShare * shares;
  }
  const intrinsic = leg.type === "call" ? Math.max(0, S - leg.strike) : Math.max(0, leg.strike - S);
  const perShare = leg.side === "buy" ? intrinsic - leg.premium : leg.premium - intrinsic;
  return perShare * shares;
}

export function combinedPayoff(legs: StrategyLeg[], S: number): number {
  return legs.reduce((sum, leg) => sum + legPayoff(leg, S), 0);
}

export interface PayoffPoint {
  s: number;
  pnl: number;
}

export interface StrategyResult {
  curve: PayoffPoint[];
  maxProfit: number | null; // null = theoretically unbounded
  maxProfitUnbounded: boolean;
  maxLoss: number | null; // null = theoretically unbounded (₹ figure otherwise, negative)
  maxLossUnbounded: boolean;
  breakevens: number[];
  netPremium: number; // >0 net credit received, <0 net debit paid
  definedRisk: boolean;
  totalShares: number;
}

/** Combined payoff curve + risk figures. Unbounded loss (a net short-call book)
 *  is detected from the far-right tail slope and reported as unbounded, never
 *  hidden behind a finite sampled minimum. */
export function buildStrategy(legs: StrategyLeg[], spot: number): StrategyResult {
  const strikes = legs.filter((l) => l.type !== "stock").map((l) => l.strike);
  const anchor = strikes.length ? strikes : [spot];
  const lo = Math.max(0.01, Math.min(spot, ...anchor) * 0.6);
  const hi = Math.max(spot, ...anchor) * 1.4;

  const N = 160;
  const curve: PayoffPoint[] = [];
  for (let i = 0; i <= N; i++) {
    const s = lo + ((hi - lo) * i) / N;
    curve.push({ s: round2(s), pnl: round2(combinedPayoff(legs, s)) });
  }

  const netPremium = round2(
    legs
      .filter((l) => l.type !== "stock")
      .reduce((sum, l) => sum + (l.side === "buy" ? -1 : 1) * l.premium * l.qty * l.lotSize, 0),
  );

  // Tail behaviour: slope per +1 of S at the far right (net calls) and payoff at
  // S→0 (net puts/stock). Unbounded loss only comes from net short calls.
  const far = hi * 6;
  const highSlope = combinedPayoff(legs, far + 1) - combinedPayoff(legs, far);
  const maxLossUnbounded = highSlope < -1e-6;
  const maxProfitUnbounded = highSlope > 1e-6;

  // Finite extremes: sample the curve plus the structural test points.
  const testPts = [0, lo, hi, spot, far, ...anchor];
  const pnls = [...curve.map((p) => p.pnl), ...testPts.map((s) => combinedPayoff(legs, Math.max(0, s)))];
  const maxProfitFinite = round2(Math.max(...pnls));
  const maxLossFinite = round2(Math.min(...curve.map((p) => p.pnl), combinedPayoff(legs, 0)));

  // Breakevens: zero crossings along the curve (linear interpolation).
  const breakevens: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    if ((a.pnl <= 0 && b.pnl > 0) || (a.pnl >= 0 && b.pnl < 0)) {
      const frac = Math.abs(a.pnl) / (Math.abs(a.pnl) + Math.abs(b.pnl) || 1);
      breakevens.push(round2(a.s + (b.s - a.s) * frac));
    }
  }

  const totalShares = legs.reduce((s, l) => s + l.qty * l.lotSize, 0);

  return {
    curve,
    maxProfit: maxProfitUnbounded ? null : maxProfitFinite,
    maxProfitUnbounded,
    maxLoss: maxLossUnbounded ? null : maxLossFinite,
    maxLossUnbounded,
    breakevens,
    netPremium,
    definedRisk: !maxLossUnbounded,
    totalShares,
  };
}

// ===== Preset templates =====

export type PresetId =
  | "long_straddle"
  | "short_straddle"
  | "strangle"
  | "bull_call"
  | "bear_put"
  | "iron_condor"
  | "covered_call";

export interface PresetMeta {
  id: PresetId;
  label: string;
  blurb: string;
}

export const PRESETS: PresetMeta[] = [
  { id: "long_straddle", label: "Long straddle", blurb: "Buy ATM call + put — profits on a big move either way" },
  { id: "strangle", label: "Long strangle", blurb: "Buy OTM call + put — cheaper, needs a bigger move" },
  { id: "bull_call", label: "Bull call spread", blurb: "Buy ATM call, sell higher call — defined risk, capped gain" },
  { id: "bear_put", label: "Bear put spread", blurb: "Buy ATM put, sell lower put — defined risk, capped gain" },
  { id: "iron_condor", label: "Iron condor", blurb: "Sell a put spread + a call spread — defined risk, range-bound" },
  { id: "covered_call", label: "Covered call", blurb: "Own stock, sell a call against it — income, capped upside" },
  { id: "short_straddle", label: "Short straddle", blurb: "Sell ATM call + put — UNDEFINED risk, collects premium" },
];

export interface PresetContext {
  spot: number;
  strikes: number[]; // available strikes, ascending
  lotSize: number;
  iv: number; // ATM IV %
  dteDays: number;
}

function priceLeg(type: "call" | "put", ctx: PresetContext, strike: number): number {
  return bsPrice(ctx.spot, strike, ctx.iv, ctx.dteDays, type);
}

/** Build the legs for a preset. Strikes are picked from the available chain
 *  around ATM; premiums are Black-Scholes estimates (editable in the UI). */
export function presetLegs(id: PresetId, ctx: PresetContext): StrategyLeg[] {
  const { strikes, spot, lotSize } = ctx;
  const atmIdx = strikes.reduce((best, k, i) => (Math.abs(k - spot) < Math.abs(strikes[best] - spot) ? i : best), 0);
  const at = (offset: number) => strikes[Math.max(0, Math.min(strikes.length - 1, atmIdx + offset))];
  const leg = (type: "call" | "put", side: LegSide, strike: number, qty = 1): StrategyLeg => ({
    type, side, strike, premium: priceLeg(type, ctx, strike), qty, lotSize,
  });

  switch (id) {
    case "long_straddle":
      return [leg("call", "buy", at(0)), leg("put", "buy", at(0))];
    case "short_straddle":
      return [leg("call", "sell", at(0)), leg("put", "sell", at(0))];
    case "strangle":
      return [leg("call", "buy", at(1)), leg("put", "buy", at(-1))];
    case "bull_call":
      return [leg("call", "buy", at(0)), leg("call", "sell", at(2))];
    case "bear_put":
      return [leg("put", "buy", at(0)), leg("put", "sell", at(-2))];
    case "iron_condor":
      return [
        leg("put", "sell", at(-1)), leg("put", "buy", at(-2)),
        leg("call", "sell", at(1)), leg("call", "buy", at(2)),
      ];
    case "covered_call":
      return [
        { type: "stock", side: "buy", strike: spot, premium: 0, qty: 1, lotSize },
        leg("call", "sell", at(1)),
      ];
  }
}
