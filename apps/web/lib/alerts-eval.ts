// Alert evaluation — pure logic, unit-tested. Given an alert and the current
// market context for its symbol, decide whether the condition is met and what
// value to record. The cron handler (/api/cron/evaluate-alerts) wires real
// quotes into this; keeping it pure makes it testable and side-effect-free.

import type { Alert } from "./store";
import type { Stock } from "./types";

export interface AlertContext {
  price: number;
  support: number[];
  resistance: number[];
  week52Low: number | null;
  week52High: number | null;
  iv: number;
  pcr: number;
}

/** Parse "266.6 – 391.65" (the Stock.week52 display string) into [low, high]. */
export function parse52w(week52: string): { low: number | null; high: number | null } {
  const nums = week52.replace(/,/g, "").match(/[\d.]+/g);
  if (!nums || nums.length < 2) return { low: null, high: null };
  const a = parseFloat(nums[0]);
  const b = parseFloat(nums[1]);
  return { low: Math.min(a, b), high: Math.max(a, b) };
}

export function contextFromStock(stock: Stock, livePrice?: number): AlertContext {
  const { low, high } = parse52w(stock.week52);
  return {
    price: livePrice ?? stock.price,
    support: stock.technicals.support,
    resistance: stock.technicals.resistance,
    week52Low: low,
    week52High: high,
    iv: stock.options.iv,
    pcr: stock.options.pcr,
  };
}

export interface AlertEvaluation {
  triggered: boolean;
  value: number;
}

/** Evaluate one alert against current context. `value` is the metric reading
 *  that drove the decision, stored on trigger for display. */
export function evaluateAlert(alert: Alert, ctx: AlertContext): AlertEvaluation {
  const t = alert.threshold;
  switch (alert.conditionType) {
    case "price_above":
      return { triggered: t != null && ctx.price >= t, value: ctx.price };
    case "price_below":
      return { triggered: t != null && ctx.price <= t, value: ctx.price };
    case "cross_resistance": {
      const level = ctx.resistance[0];
      return { triggered: level != null && ctx.price >= level, value: ctx.price };
    }
    case "cross_support": {
      const level = ctx.support[0];
      return { triggered: level != null && ctx.price <= level, value: ctx.price };
    }
    case "52w_high":
      return { triggered: ctx.week52High != null && ctx.price >= ctx.week52High, value: ctx.price };
    case "52w_low":
      return { triggered: ctx.week52Low != null && ctx.price <= ctx.week52Low, value: ctx.price };
    case "iv_spike":
      // threshold is an IV percentage; fire when implied vol reaches it.
      return { triggered: t != null && ctx.iv >= t, value: ctx.iv };
    case "pcr_shift":
      // threshold is a PCR level; fire when PCR reaches/crosses it upward.
      return { triggered: t != null && ctx.pcr >= t, value: ctx.pcr };
    default:
      return { triggered: false, value: ctx.price };
  }
}

/** Human-readable one-liner for a triggered (or pending) alert. */
export function describeAlert(alert: Alert): string {
  const t = alert.threshold;
  switch (alert.conditionType) {
    case "price_above":
      return `${alert.symbol} rises above ₹${t}`;
    case "price_below":
      return `${alert.symbol} falls below ₹${t}`;
    case "cross_resistance":
      return `${alert.symbol} crosses resistance`;
    case "cross_support":
      return `${alert.symbol} crosses support`;
    case "52w_high":
      return `${alert.symbol} hits a new 52-week high`;
    case "52w_low":
      return `${alert.symbol} hits a new 52-week low`;
    case "iv_spike":
      return `${alert.symbol} IV spikes above ${t}%`;
    case "pcr_shift":
      return `${alert.symbol} PCR crosses ${t}`;
    default:
      return `${alert.symbol} alert`;
  }
}
