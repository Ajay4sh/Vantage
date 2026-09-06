// Phase 9: risk-aware F&O engine. Pure functions, unit-tested in
// tests/risk.test.ts — the math behind the pre-trade risk gate, embedded
// position sizing, and the personal loss-pattern mirror.
//
// Framing rule (Phase 9 guardrails, keep it): nothing here is trade advice or
// encouragement. Every output is a risk figure — a max loss, a % of capital, a
// breakeven, a comparison against the user's own history or SEBI's published
// findings. If a change would make a position look more attractive rather than
// more understood, it does not belong in this file.

import type { TradeLog } from "./store";

const round2 = (x: number) => Math.round(x * 100) / 100;
const round1 = (x: number) => Math.round(x * 10) / 10;

// ===== Position side =====

export type TradeSide = "buy_call" | "buy_put" | "sell_call" | "sell_put";

export const SIDE_LABELS: Record<TradeSide, string> = {
  buy_call: "Buy call (long call)",
  buy_put: "Buy put (long put)",
  sell_call: "Sell call (naked short call)",
  sell_put: "Sell put (naked short put)",
};

export function isShortSide(side: TradeSide): boolean {
  return side === "sell_call" || side === "sell_put";
}

export function isBuyerSide(side: string): boolean {
  return side === "buy_call" || side === "buy_put";
}

// ===== Position risk =====

export interface PositionInput {
  side: TradeSide;
  strike: number;
  premium: number; // option price per share
  lotSize: number;
  contracts: number;
  spot: number;
}

export interface PositionRisk {
  /** True only for long options: the most you can lose is the premium paid. */
  definedRisk: boolean;
  isShort: boolean;
  /** ₹ max loss for the whole position. null == theoretically unbounded. */
  maxLoss: number | null;
  maxLossUnbounded: boolean;
  /** ₹ max profit. null == theoretically unbounded (a long call). */
  maxProfit: number | null;
  maxProfitUnbounded: boolean;
  breakeven: number;
  /** ₹ premium paid (long) or collected (short) across all contracts. */
  premiumFlow: number;
  /** ₹ premium × lot size for one contract — the sizing unit for a long. */
  perContractPremium: number;
  shares: number; // lotSize × contracts
}

/** Standard textbook payoff math for a single-leg option position. Long legs
 *  are defined-risk (max loss = premium paid). Short legs are flagged as
 *  undefined risk: a naked short call is genuinely unbounded; a naked short put
 *  is bounded only at (strike − premium) × shares, which for any real position
 *  is a large multiple of the premium collected — so it too carries the heavier
 *  acknowledgment, never the "defined risk" label. */
export function computePositionRisk(i: PositionInput): PositionRisk {
  const shares = Math.max(0, Math.round(i.lotSize * i.contracts));
  const perContractPremium = round2(i.premium * i.lotSize);
  const premiumFlow = round2(i.premium * shares);
  const isShort = isShortSide(i.side);

  // Breakeven is the same formula for the writer and the holder of a given leg.
  const breakeven =
    i.side === "buy_call" || i.side === "sell_call"
      ? round2(i.strike + i.premium)
      : round2(i.strike - i.premium);

  if (!isShort) {
    // Long call / long put: lose at most the premium paid.
    const longPutMaxProfit = round2(Math.max(0, i.strike - i.premium) * shares);
    return {
      definedRisk: true,
      isShort: false,
      maxLoss: premiumFlow,
      maxLossUnbounded: false,
      maxProfit: i.side === "buy_call" ? null : longPutMaxProfit,
      maxProfitUnbounded: i.side === "buy_call",
      breakeven,
      premiumFlow,
      perContractPremium,
      shares,
    };
  }

  // Short call: unbounded loss. Short put: bounded at (strike − premium)×shares
  // but still undefined-risk in spirit (a large multiple of premium collected).
  const shortPutMaxLoss = round2(Math.max(0, i.strike - i.premium) * shares);
  return {
    definedRisk: false,
    isShort: true,
    maxLoss: i.side === "sell_call" ? null : shortPutMaxLoss,
    maxLossUnbounded: i.side === "sell_call",
    maxProfit: premiumFlow, // most a writer keeps is the premium collected
    maxProfitUnbounded: false,
    breakeven,
    premiumFlow,
    perContractPremium,
    shares,
  };
}

/** Max loss as a percentage of stated trading capital. null when capital is
 *  unset or the loss is unbounded — a % of an unbounded number is meaningless
 *  and must never render as a comfortable-looking figure. */
export function capitalAtRiskPct(maxLoss: number | null, capital: number | null): number | null {
  if (maxLoss === null || capital === null || capital <= 0) return null;
  return round1((maxLoss / capital) * 100);
}

// ===== Position sizing (Feature 2) =====

export interface SizingInput {
  capital: number;
  riskPct: number; // e.g. 2 for a 2% risk budget
  perContractPremium: number; // premium × lot size (max loss per long contract)
}

export interface Sizing {
  maxRiskAmount: number; // ₹ capital × risk%
  suggestedContracts: number; // whole contracts that fit the risk budget
}

/** max_risk_amount = capital × risk%; suggested = floor(budget / per-contract
 *  premium). Defined for a long option, where per-contract premium is the
 *  actual per-contract max loss. For shorts the caller must flag that this is a
 *  premium-based proxy, not the real (undefined) risk. */
export function computeSizing(i: SizingInput): Sizing {
  const maxRiskAmount = round2(i.capital * (i.riskPct / 100));
  const suggestedContracts =
    i.perContractPremium > 0 ? Math.floor(maxRiskAmount / i.perContractPremium) : 0;
  return { maxRiskAmount, suggestedContracts };
}

/** How the entered size compares to the suggestion, e.g. "3.0x" the budgeted
 *  size. null when there's nothing meaningful to compare against. */
export function sizeMultiple(entered: number, suggested: number): number | null {
  if (suggested <= 0) return null;
  return round1(entered / suggested);
}

// ===== SEBI published findings (Feature 3 reference frame) =====
// Plain-language restatements of SEBI's studies on individual F&O traders,
// used only as an honest comparison backdrop for the personal mirror. Not
// predictive of any individual outcome; cited as SEBI's aggregate findings.

export const SEBI_FINDINGS = {
  lossRate:
    "About 9 in 10 individual F&O traders lost money over the periods SEBI studied (FY22 through FY24) — a finding that has stayed remarkably stable across years.",
  buyersVsSellers:
    "SEBI found option buyers fared substantially worse than option sellers: buyers paid the premium and, in aggregate, most of it decayed away.",
  netLosses:
    "Losses were concentrated, persistent, and grew with trading frequency — the more actively individuals traded, the larger their aggregate losses tended to be.",
  source: "SEBI studies on the profit/loss of individual traders in the equity F&O segment.",
} as const;

// ===== Trade-log aggregate stats (Feature 3 + 4) =====

export interface AggStat {
  count: number;
  wins: number;
  winRate: number | null; // % of closed trades that were profitable, null if none closed
  totalPnl: number; // ₹, closed trades only
  avgPnl: number | null; // ₹ per closed trade
}

export interface MirrorStats {
  overall: AggStat;
  buyers: AggStat; // buy_call / buy_put
  sellers: AggStat; // everything else (writers, spreads)
  expiryDay: AggStat; // trades logged on their own expiry date
  swing: AggStat; // trades not logged on expiry date
  byStrategy: { strategy: string; stat: AggStat }[];
  closedCount: number;
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/** A trade "counts" toward win rate / P&L only once it's closed (has a pnl).
 *  Open trades still show up in counts so the mirror reflects real activity. */
function aggregate(trades: TradeLog[]): AggStat {
  const closed = trades.filter((t) => t.pnl !== null);
  const wins = closed.filter((t) => (t.pnl as number) > 0).length;
  const totalPnl = round2(closed.reduce((a, t) => a + (t.pnl as number), 0));
  return {
    count: trades.length,
    wins,
    winRate: closed.length ? round1((wins / closed.length) * 100) : null,
    totalPnl,
    avgPnl: closed.length ? round2(totalPnl / closed.length) : null,
  };
}

/** Whether a trade was logged on its own expiry date — the heuristic the
 *  expiry-day mirror and nudge use (we store logged_at, not a separate entry
 *  date, so same-day-expiry activity is detected this way). */
export function isExpiryDayTrade(t: TradeLog): boolean {
  return !!t.expiryDate && dateOnly(t.loggedAt) === t.expiryDate;
}

export function computeMirrorStats(trades: TradeLog[]): MirrorStats {
  const byStrategyMap = new Map<string, TradeLog[]>();
  for (const t of trades) {
    const key = t.strategyType || "other";
    (byStrategyMap.get(key) ?? byStrategyMap.set(key, []).get(key)!).push(t);
  }

  return {
    overall: aggregate(trades),
    buyers: aggregate(trades.filter((t) => isBuyerSide(t.strategyType))),
    sellers: aggregate(trades.filter((t) => !isBuyerSide(t.strategyType))),
    expiryDay: aggregate(trades.filter(isExpiryDayTrade)),
    swing: aggregate(trades.filter((t) => !isExpiryDayTrade(t))),
    byStrategy: Array.from(byStrategyMap.entries())
      .map(([strategy, ts]) => ({ strategy, stat: aggregate(ts) }))
      .sort((a, b) => b.stat.count - a.stat.count),
    closedCount: trades.filter((t) => t.pnl !== null).length,
  };
}

// ===== Expiry-day reflection (Feature 4) =====

export interface ReflectionInput {
  /** True when the position expires today (dte 0) — same-day expiry. */
  sameDayExpiry: boolean;
  capitalRiskPct: number | null; // this position's max loss as % of capital
  riskBudgetPct: number; // the user's configured risk budget
  enteredContracts: number;
  suggestedContracts: number;
  expiryDayStats: AggStat; // the user's own expiry-day history
}

export interface Reflection {
  show: boolean;
  /** "large relative to capital" trigger — over budget, or oversized vs the
   *  suggestion. */
  oversized: boolean;
  message: string;
}

/** Decide whether to surface the expiry-day reflection prompt, and with what
 *  copy. It is a nudge, never a block — the caller always keeps a normal
 *  proceed action. Prefers the user's own history; falls back to SEBI's
 *  aggregate finding when there isn't enough personal data yet. */
export function buildReflection(i: ReflectionInput): Reflection {
  if (!i.sameDayExpiry) return { show: false, oversized: false, message: "" };

  const overBudget = i.capitalRiskPct !== null && i.capitalRiskPct > i.riskBudgetPct;
  const oversized =
    overBudget || (i.suggestedContracts > 0 && i.enteredContracts > i.suggestedContracts);

  // Personal history takes precedence once there's enough of it to be honest.
  const s = i.expiryDayStats;
  if (s.count >= 3 && s.avgPnl !== null) {
    const avg = s.avgPnl;
    const verb = avg < 0 ? "a loss" : "a gain";
    const amount = `₹${Math.abs(avg).toLocaleString("en-IN")}`;
    return {
      show: true,
      oversized,
      message: `Your ${s.count} logged expiry-day trades averaged ${verb} of ${amount}${
        s.winRate !== null ? ` (win rate ${s.winRate}%)` : ""
      }. Expiry-day options decay fastest of all — still want to proceed?`,
    };
  }

  return {
    show: true,
    oversized,
    message: `This is a same-day-expiry position — the fastest-decaying, highest-variance kind. ${SEBI_FINDINGS.lossRate} There's no personal expiry-day history logged yet to compare against. Still want to proceed?`,
  };
}
