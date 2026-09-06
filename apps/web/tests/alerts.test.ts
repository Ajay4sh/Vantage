import { describe, expect, it } from "vitest";
import { evaluateAlert, parse52w } from "../lib/alerts-eval";
import type { Alert, AlertCondition } from "../lib/store";

function alert(conditionType: AlertCondition, threshold: number | null = null): Alert {
  return {
    id: "a1",
    userId: "u1",
    symbol: "BPCL",
    conditionType,
    threshold,
    note: null,
    createdAt: new Date().toISOString(),
    triggeredAt: null,
    lastValue: null,
  };
}

const ctx = {
  price: 300,
  support: [290, 280],
  resistance: [320, 340],
  week52Low: 266.6,
  week52High: 391.65,
  iv: 38.5,
  pcr: 0.94,
};

describe("parse52w", () => {
  it("parses the demo range string into low/high", () => {
    expect(parse52w("266.6 – 391.65")).toEqual({ low: 266.6, high: 391.65 });
  });
  it("handles commas and returns nulls when unparseable", () => {
    expect(parse52w("1,520 – 1,880")).toEqual({ low: 1520, high: 1880 });
    expect(parse52w("n/a")).toEqual({ low: null, high: null });
  });
});

describe("evaluateAlert", () => {
  it("price_above / price_below fire on the threshold", () => {
    expect(evaluateAlert(alert("price_above", 295), ctx).triggered).toBe(true);
    expect(evaluateAlert(alert("price_above", 305), ctx).triggered).toBe(false);
    expect(evaluateAlert(alert("price_below", 305), ctx).triggered).toBe(true);
    expect(evaluateAlert(alert("price_below", 295), ctx).triggered).toBe(false);
  });

  it("cross_resistance / cross_support use nearest levels", () => {
    expect(evaluateAlert(alert("cross_resistance"), { ...ctx, price: 325 }).triggered).toBe(true);
    expect(evaluateAlert(alert("cross_resistance"), { ...ctx, price: 310 }).triggered).toBe(false);
    expect(evaluateAlert(alert("cross_support"), { ...ctx, price: 285 }).triggered).toBe(true);
    expect(evaluateAlert(alert("cross_support"), { ...ctx, price: 295 }).triggered).toBe(false);
  });

  it("52-week high/low fire at the band edges", () => {
    expect(evaluateAlert(alert("52w_high"), { ...ctx, price: 392 }).triggered).toBe(true);
    expect(evaluateAlert(alert("52w_low"), { ...ctx, price: 266 }).triggered).toBe(true);
    expect(evaluateAlert(alert("52w_high"), ctx).triggered).toBe(false);
  });

  it("iv_spike and pcr_shift compare their own metric, not price", () => {
    expect(evaluateAlert(alert("iv_spike", 35), ctx).triggered).toBe(true);
    expect(evaluateAlert(alert("iv_spike", 40), ctx).triggered).toBe(false);
    expect(evaluateAlert(alert("iv_spike", 35), ctx).value).toBe(38.5);
    expect(evaluateAlert(alert("pcr_shift", 0.9), ctx).triggered).toBe(true);
    expect(evaluateAlert(alert("pcr_shift", 1.1), ctx).triggered).toBe(false);
  });

  it("threshold-less conditions never fire without a level", () => {
    expect(evaluateAlert(alert("price_above", null), ctx).triggered).toBe(false);
  });
});
