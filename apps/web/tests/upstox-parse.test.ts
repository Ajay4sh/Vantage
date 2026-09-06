// Parser guards for Upstox responses — the "did the shape change" tests the
// build instructions §7 call out. Every parser must throw on malformed input
// rather than returning something plausible-looking.

import { describe, expect, it } from "vitest";
import { parseCandleResponse, parseIncomeStatement, parseKeyRatios } from "../lib/upstox/client";

describe("parseCandleResponse", () => {
  const valid = {
    status: "success",
    data: {
      candles: [
        ["2026-07-09T00:00:00+05:30", 100, 105, 99, 104, 1000, 0],
        ["2026-07-08T00:00:00+05:30", 98, 101, 97, 100, 900, 0],
      ],
    },
  };

  it("parses rows and flips newest-first to oldest-first", () => {
    const candles = parseCandleResponse(valid);
    expect(candles).toHaveLength(2);
    expect(candles[0].close).toBe(100);
    expect(candles[1].close).toBe(104);
    expect(candles[1].high).toBe(105);
  });

  it("throws on a changed envelope", () => {
    expect(() => parseCandleResponse({ status: "error" })).toThrow(/shape changed/);
    expect(() => parseCandleResponse({ status: "success", data: {} })).toThrow(/shape changed/);
  });

  it("throws on non-numeric OHLC rather than emitting NaN candles", () => {
    const bad = { status: "success", data: { candles: [["ts", "a", 1, 2, 3, 4, 0]] } };
    expect(() => parseCandleResponse(bad)).toThrow(/non-numeric/);
  });

  it("throws on zero candles", () => {
    expect(() => parseCandleResponse({ status: "success", data: { candles: [] } })).toThrow(/zero candles/);
  });
});

describe("parseKeyRatios", () => {
  it("extracts ratios by fuzzy name match", () => {
    const ratios = parseKeyRatios({
      status: "success",
      data: [
        { name: "P/E (x)", company_value: "24.10", sector_value: "18.30" },
        { name: "ROE (%)", company_value: "14.2", sector_value: "12.0" },
        { name: "ROCE (%)", company_value: "17.8", sector_value: "15.1" },
      ],
    });
    expect(ratios.pe).toEqual({ company: 24.1, sector: 18.3 });
    expect(ratios.roe).toEqual({ company: 14.2, sector: 12 });
    expect(ratios.roce?.company).toBe(17.8);
  });

  it("throws when nothing recognizable comes back", () => {
    expect(() => parseKeyRatios({ status: "success", data: [{ name: "Mystery", company_value: "1" }] })).toThrow(
      /no recognizable ratios/,
    );
    expect(() => parseKeyRatios({ status: "success", data: "nope" })).toThrow(/shape changed/);
  });
});

describe("parseIncomeStatement", () => {
  const valid = {
    status: "success",
    data: {
      income_statement: [
        {
          category: "revenue",
          history: [
            { value: 909, period: "Mar 2025" },
            { value: 1000, period: "Mar 2026", change: "+10.0%" },
          ],
        },
        { category: "operating_profit", history: [{ value: 150, period: "Mar 2026" }] },
        { category: "net_profit", history: [{ value: 100, period: "Mar 2026" }] },
      ],
      full_statement: [
        {
          particular: "EPS - Basic",
          history: [
            { period: "Mar 2025", value: 45 },
            { period: "Mar 2026", value: 51.5 },
          ],
        },
      ],
    },
  };

  it("summarises the latest period regardless of history order", () => {
    const s = parseIncomeStatement(valid);
    expect(s.revGrowth).toBe(10);
    expect(s.opMargin).toBe(15);
    expect(s.netMargin).toBe(10);
    expect(s.eps).toBe(51.5);
  });

  it("computes growth from values when the change field is absent", () => {
    const noChange = JSON.parse(JSON.stringify(valid));
    delete noChange.data.income_statement[0].history[1].change;
    expect(parseIncomeStatement(noChange).revGrowth).toBeCloseTo(10, 1);
  });

  it("throws when revenue is missing", () => {
    expect(() => parseIncomeStatement({ status: "success", data: { income_statement: [] } })).toThrow(
      /missing revenue/,
    );
    expect(() => parseIncomeStatement({ status: "success", data: {} })).toThrow(/shape changed/);
  });
});
