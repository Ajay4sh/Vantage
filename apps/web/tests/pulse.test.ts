import { describe, expect, it } from "vitest";
import { computeMarketPulse, computeSectorMood, MOOD_COLOR, moodFromScore } from "../lib/pulse";
import { SAMPLE_STOCKS } from "../lib/sample-data";
import type { IndexQuote, Stock } from "../lib/types";

function idx(name: string, changePct: number): IndexQuote {
  return { name, prefix: "", decimals: 0, value: 24000, changePct };
}

describe("moodFromScore", () => {
  it("keeps calm days neutral, only strong readings tip", () => {
    expect(moodFromScore(0)).toBe("neutral");
    expect(moodFromScore(10)).toBe("neutral");
    expect(moodFromScore(-10)).toBe("neutral");
    expect(moodFromScore(20)).toBe("bullish");
    expect(moodFromScore(-20)).toBe("bearish");
  });
  it("maps moods to the design colors", () => {
    expect(MOOD_COLOR.bullish).toBe("#35B08B");
    expect(MOOD_COLOR.neutral).toBe("#D4A73C");
    expect(MOOD_COLOR.bearish).toBe("#E0616B");
  });
});

describe("computeSectorMood", () => {
  it("reads the sector's stocks and names a lead + summary", () => {
    const sm = computeSectorMood("Energy", [SAMPLE_STOCKS.BPCL, SAMPLE_STOCKS.RELIANCE]);
    expect(sm.name).toBe("Energy");
    expect(sm.lead).toBe("BPCL");
    expect(["bullish", "neutral", "bearish"]).toContain(sm.mood);
    expect(sm.summary).toContain("Energy");
    expect(sm.summary).toContain("BPCL");
  });
  it("falls back to neutral with no stocks", () => {
    const sm = computeSectorMood("Pharma", []);
    expect(sm.mood).toBe("neutral");
    expect(sm.lead).toBe("PHARMA");
  });
});

describe("computeMarketPulse", () => {
  const stocksBySymbol: Record<string, Stock> = {
    BPCL: SAMPLE_STOCKS.BPCL,
    RELIANCE: SAMPLE_STOCKS.RELIANCE,
    TCS: SAMPLE_STOCKS.TCS,
    INFY: SAMPLE_STOCKS.INFY,
    HDFCBANK: SAMPLE_STOCKS.HDFCBANK,
    ITC: SAMPLE_STOCKS.ITC,
  };

  it("produces a full snapshot with honest structure", () => {
    const pulse = computeMarketPulse({
      stocksBySymbol,
      indices: [idx("NIFTY 50", 0.05), idx("SENSEX", 0.03)],
    });
    expect(["bullish", "neutral", "bearish"]).toContain(pulse.mood);
    expect(pulse.color).toBe(MOOD_COLOR[pulse.mood]);
    expect(pulse.headline).toMatch(/Markets are/);
    expect(pulse.indices.map((i) => i.name)).toEqual(["NIFTY 50", "SENSEX"]);
    expect(pulse.sectors).toHaveLength(6);
    expect(pulse.story.title.length).toBeGreaterThan(0);
    // Story must describe, never predict — no future-tense "will".
    expect(pulse.story.body.toLowerCase()).not.toContain("will ");
  });

  it("goes bullish when indices are clearly up", () => {
    const pulse = computeMarketPulse({
      stocksBySymbol,
      indices: [idx("NIFTY 50", 1.2), idx("SENSEX", 1.1)],
    });
    expect(pulse.mood).toBe("bullish");
    expect(pulse.headline).toContain("upbeat");
  });

  it("goes bearish when indices are clearly down", () => {
    const pulse = computeMarketPulse({
      stocksBySymbol,
      indices: [idx("NIFTY 50", -1.3), idx("SENSEX", -1.2)],
    });
    expect(pulse.mood).toBe("bearish");
    expect(pulse.headline).toContain("pressure");
  });
});
