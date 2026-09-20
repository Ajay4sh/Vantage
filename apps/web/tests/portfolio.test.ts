import { describe, expect, it } from "vitest";
import {
  buildPortfolioRadar,
  computeConcentration,
  computeCorrelatedClusters,
  computeExpiryExposure,
  computeFnoRisk,
  computePortfolioImpliedMove,
  pearson,
  type PortfolioPosition,
} from "../lib/risk/portfolio";

const HIST = [100, 101, 102, 103, 104, 105, 106];
// A deliberately uncorrelated (oscillating) series for names that shouldn't cluster.
const HIST_OSC = [100, 98, 101, 97, 102, 96, 103];

function equity(
  symbol: string,
  sector: string,
  qty: number,
  price: number,
  iv = 20,
  hist: number[] = HIST,
): PortfolioPosition {
  return {
    symbol,
    sector,
    instrument: "equity",
    quantity: qty,
    avgPrice: price,
    lastPrice: price,
    priceHistory: hist,
    spot: price,
    iv,
  };
}

function option(
  symbol: string,
  sector: string,
  side: "long" | "short",
  type: "CE" | "PE",
  expiry: string,
  extra: Partial<PortfolioPosition> = {},
): PortfolioPosition {
  const lot = 50;
  return {
    symbol,
    sector,
    instrument: "option",
    quantity: side === "long" ? lot : -lot,
    avgPrice: 5, // premium
    lastPrice: 5,
    priceHistory: HIST,
    spot: 100,
    side,
    optionType: type,
    strike: 100,
    expiry,
    lotSize: lot,
    iv: 20,
    ...extra,
  };
}

describe("computeConcentration", () => {
  it("computes name/sector % and flags past thresholds", () => {
    const c = computeConcentration([
      equity("RELIANCE", "Energy", 100, 100), // 10000
      equity("BPCL", "Energy", 100, 100), // 10000
      equity("TCS", "IT", 100, 100), // 10000
    ]);
    expect(c.total).toBe(30000);
    const reliance = c.byName.find((s) => s.label === "RELIANCE")!;
    expect(reliance.pct).toBeCloseTo(33.3, 1);
    expect(reliance.flagged).toBe(true); // > 25%
    const energy = c.bySector.find((s) => s.label === "Energy")!;
    expect(energy.pct).toBeCloseTo(66.7, 1);
    expect(energy.flagged).toBe(true); // > 40%
    expect(c.flags.some((f) => f.kind === "sector" && f.label === "Energy")).toBe(true);
  });
});

describe("pearson", () => {
  it("is +1 for identical return series, -1 for mirrored", () => {
    const a = [0.1, -0.05, 0.02, 0.03, -0.01, 0.04];
    const b = a.map((x) => -x);
    expect(pearson(a, a)).toBe(1);
    expect(pearson(a, b)).toBe(-1);
  });
  it("returns null with too little overlap", () => {
    expect(pearson([0.1, 0.2], [0.1, 0.2])).toBeNull();
  });
});

describe("computeCorrelatedClusters", () => {
  it("clusters positions whose underlyings move together", () => {
    // Two bank names with identical histories → correlation 1 → one cluster.
    const clusters = computeCorrelatedClusters([
      equity("HDFCBANK", "Banking", 100, 100),
      equity("ICICIBANK", "Banking", 100, 100),
      equity("TCS", "IT", 100, 100, 20, HIST_OSC), // uncorrelated → excluded
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].symbols).toEqual(["HDFCBANK", "ICICIBANK"]);
    expect(clusters[0].avgCorrelation).toBe(1);
  });
});

describe("computeFnoRisk", () => {
  it("sums defined max-loss and flags a naked short call as unbounded", () => {
    const defined = computeFnoRisk([option("BPCL", "Energy", "long", "CE", "2026-09-25")], 100000);
    expect(defined.unbounded).toBe(false);
    expect(defined.totalMaxLoss).toBe(250); // premium 5 × lot 50 × 1 contract
    expect(defined.pctOfCapital).toBeCloseTo(0.3, 1);

    const naked = computeFnoRisk(
      [option("RELIANCE", "Energy", "short", "CE", "2026-09-25")],
      100000,
    );
    expect(naked.unbounded).toBe(true);
    expect(naked.pctOfCapital).toBeNull(); // can't express an unbounded loss as a %
  });
});

describe("computeExpiryExposure", () => {
  it("flags expiries shared by multiple positions", () => {
    const buckets = computeExpiryExposure([
      option("BPCL", "Energy", "long", "CE", "2026-09-25"),
      option("HDFCBANK", "Banking", "long", "PE", "2026-09-25"),
      option("TCS", "IT", "long", "CE", "2026-10-30"),
    ]);
    const shared = buckets.find((b) => b.expiry === "2026-09-25")!;
    expect(shared.positions).toBe(2);
    expect(shared.clustered).toBe(true);
    const solo = buckets.find((b) => b.expiry === "2026-10-30")!;
    expect(solo.clustered).toBe(false);
  });
});

describe("computePortfolioImpliedMove", () => {
  it("combines in quadrature (two equal positions ≈ single × √2)", () => {
    const single = computePortfolioImpliedMove([equity("A", "X", 10, 100)]);
    const pair = computePortfolioImpliedMove([equity("A", "X", 10, 100), equity("B", "Y", 10, 100)]);
    expect(single.oneSD).toBeGreaterThan(0);
    expect(pair.oneSD).toBeCloseTo(single.oneSD * Math.SQRT2, 1);
    expect(pair.twoSD).toBeCloseTo(pair.oneSD * 2, 5);
  });
});

describe("buildPortfolioRadar", () => {
  it("assembles all sections and counts flags", () => {
    const radar = buildPortfolioRadar(
      [
        equity("RELIANCE", "Energy", 220, 100), // concentrated name + sector
        equity("BPCL", "Energy", 200, 100),
        option("RELIANCE", "Energy", "short", "CE", "2026-09-25"), // unbounded
        option("BPCL", "Energy", "long", "CE", "2026-09-25"), // shares expiry
      ],
      100000,
    );
    expect(radar.positionCount).toBe(4);
    expect(radar.fno.unbounded).toBe(true);
    expect(radar.expiry.some((e) => e.clustered)).toBe(true);
    expect(radar.flagCount).toBeGreaterThan(0);
  });
});
