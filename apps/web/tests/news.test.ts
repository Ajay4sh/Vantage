import { describe, expect, it } from "vitest";
import { heuristicTag } from "../lib/sentiment";

describe("heuristicTag", () => {
  it("reads clearly positive headlines as positive", () => {
    expect(heuristicTag("Company profit surges as revenue growth beats estimates")).toBe("positive");
    expect(heuristicTag("Brokerage upgrades stock to buy on strong outlook")).toBe("positive");
  });

  it("reads clearly negative headlines as negative", () => {
    expect(heuristicTag("Shares slip as margins decline and brokerage cuts target")).toBe("negative");
    expect(heuristicTag("Regulator probe and lawsuit weigh on the stock")).toBe("negative");
  });

  it("reads factual/mixed headlines as neutral", () => {
    expect(heuristicTag("Company to report quarterly results next week")).toBe("neutral");
    // balanced positive/negative keyword counts net to neutral
    expect(heuristicTag("Revenue growth strong but margins under pressure and costs cut")).toBe("neutral");
    expect(heuristicTag("Gains offset by losses in the quarter")).toBe("neutral");
    // one extra negative keyword tips it negative
    expect(heuristicTag("Growth strong but margins under pressure, costs cut and target trimmed")).toBe("negative");
  });

  it("is case-insensitive and ignores punctuation", () => {
    expect(heuristicTag("PROFIT JUMPS, GROWTH STRONG!")).toBe("positive");
  });
});
