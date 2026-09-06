// Dynamic-universe tests: instrument master parsing/search and the
// deterministic synthesizer for un-seeded instruments.

import { describe, expect, it } from "vitest";
import { buildDirectory, fallbackDirectory, searchDirectory } from "../lib/instruments/master";
import { synthCandles, synthChain, synthSpot, synthStock } from "../lib/synth";

describe("buildDirectory", () => {
  const raw = [
    { segment: "NSE_EQ", instrument_type: "EQ", instrument_key: "NSE_EQ|INE001", trading_symbol: "ABCLTD", name: "ABC Ltd", isin: "INE001", lot_size: 1 },
    { segment: "NSE_EQ", instrument_type: "EQ", instrument_key: "NSE_EQ|INE002", trading_symbol: "XYZBANK", name: "XYZ Bank Ltd", isin: "INE002" },
    { segment: "NSE_INDEX", instrument_key: "NSE_INDEX|Nifty 50", name: "Nifty 50" },
    { segment: "NSE_FO", instrument_type: "CE", instrument_key: "NSE_FO|12345", trading_symbol: "ABCLTD26JUL300CE" },
    { segment: "NSE_EQ", instrument_type: "SM", instrument_key: "NSE_EQ|INE003", trading_symbol: "SMESTOCK" },
  ];

  it("keeps equities and indices, drops F&O contracts and non-EQ types", () => {
    const dir = buildDirectory(raw);
    expect(dir.map((e) => e.sym)).toEqual(["ABCLTD", "XYZBANK", "NIFTY 50"]);
    expect(dir[0].kind).toBe("equity");
    expect(dir[2].kind).toBe("index");
    expect(dir[2].key).toBe("NSE_INDEX|Nifty 50");
  });

  it("throws when the dump format changes and nothing parses", () => {
    expect(() => buildDirectory([{ foo: 1 }])).toThrow(/dump format changed/);
  });
});

describe("searchDirectory", () => {
  const dir = buildDirectory([
    { segment: "NSE_EQ", instrument_type: "EQ", instrument_key: "k1", trading_symbol: "TATASTEEL", name: "Tata Steel Ltd", isin: "I1" },
    { segment: "NSE_EQ", instrument_type: "EQ", instrument_key: "k2", trading_symbol: "TATAMOTORS", name: "Tata Motors Ltd", isin: "I2" },
    { segment: "NSE_EQ", instrument_type: "EQ", instrument_key: "k3", trading_symbol: "JSWSTEEL", name: "JSW Steel Ltd", isin: "I3" },
  ]);

  it("ranks symbol-prefix matches above name matches", () => {
    const hits = searchDirectory(dir, "tata");
    expect(hits.map((e) => e.sym)).toEqual(["TATASTEEL", "TATAMOTORS"]);
    // name-substring match ("Steel") comes after symbol matches
    const steel = searchDirectory(dir, "steel");
    expect(steel[0].sym).toBe("JSWSTEEL"); // symbol substring beats name substring
    expect(steel.map((e) => e.sym)).toContain("TATASTEEL");
  });

  it("returns nothing for a blank query", () => {
    expect(searchDirectory(dir, "  ")).toEqual([]);
  });
});

describe("fallbackDirectory", () => {
  it("always contains the seeded six and headline indices", () => {
    const syms = fallbackDirectory().map((e) => e.sym);
    for (const s of ["BPCL", "RELIANCE", "TCS", "HDFCBANK", "INFY", "ITC", "NIFTY 50", "SENSEX"]) {
      expect(syms).toContain(s);
    }
  });
});

describe("synth", () => {
  it("is deterministic per symbol", () => {
    expect(synthSpot("TATASTEEL")).toBe(synthSpot("TATASTEEL"));
    expect(synthCandles("TATASTEEL", 100)).toEqual(synthCandles("TATASTEEL", 100));
    expect(synthChain("TATASTEEL", 100)).toEqual(synthChain("TATASTEEL", 100));
    expect(synthSpot("TATASTEEL")).not.toBe(synthSpot("JSWSTEEL"));
  });

  it("produces spots in a plausible NSE price range", () => {
    for (const sym of ["AAA", "BBB", "CCC", "DDD"]) {
      const spot = synthSpot(sym);
      expect(spot).toBeGreaterThanOrEqual(60);
      expect(spot).toBeLessThanOrEqual(4000);
    }
  });

  it("walks candles back to end exactly at spot", () => {
    const candles = synthCandles("TEST", 250.5);
    expect(candles).toHaveLength(120);
    expect(candles[candles.length - 1].close).toBe(250.5);
    for (const c of candles) {
      expect(c.low).toBeLessThanOrEqual(c.high);
      expect(c.close).toBeGreaterThan(0);
    }
  });

  it("builds a full honest Stock shell — no fabricated narratives", () => {
    const s = synthStock({ sym: "TATASTEEL", name: "Tata Steel Ltd", kind: "equity", lotSize: 550 });
    expect(s.sym).toBe("TATASTEEL");
    expect(s.news).toEqual([]); // never fabricate headlines
    expect(s.fundamentals.pe).toBeNull();
    expect(s.fundamentals.valuationNote).toContain("placeholder");
    expect(s.technicals.priceHistory).toHaveLength(20);
    expect(s.options.strikes).toHaveLength(7);
    expect(s.options.lotSize).toBe(550);
    expect(s.spark).toHaveLength(10);
  });

  it("marks indices and skips fundamentals language", () => {
    const idx = synthStock({ sym: "NIFTY IT", name: "Nifty IT", kind: "index" });
    expect(idx.kind).toBe("index");
    expect(idx.fundamentals.valuationNote).toContain("index");
  });
});
