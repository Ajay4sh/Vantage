// Simple-mode plain-language take. Derived entirely from data the terminal
// already computes — the conviction band plus the fundamentals valuation note
// (or the technical note for indices / un-seeded names) — condensed into one
// jargon-light sentence. No new data source, per the build prompt.

import { computeConviction } from "./conviction";
import type { Stock } from "./types";

export interface PlainTake {
  band: "constructive" | "cautious" | "mixed";
  score: number;
  headline: string; // one plain sentence
}

function bandOf(score: number): PlainTake["band"] {
  if (score > 20) return "constructive";
  if (score < -20) return "cautious";
  return "mixed";
}

const BAND_PHRASE: Record<PlainTake["band"], string> = {
  constructive: "the signals lean positive",
  cautious: "the signals lean cautious",
  mixed: "the signals are mixed",
};

/** Pick the most useful plain reason we already have on hand. */
function reasonFor(s: Stock): string {
  const note = s.fundamentals.valuationNote?.trim();
  const isPlaceholder = !note || /placeholder|don't apply|unavailable/i.test(note);
  if (!isPlaceholder) return note;
  const tech = s.technicals.note?.replace(/\s*Synthesized placeholder.*$/i, "").trim();
  if (tech) return tech;
  return "there isn't enough data yet for a fuller read";
}

export function plainTake(s: Stock): PlainTake {
  const { score } = computeConviction(s);
  const band = bandOf(score);
  const dir = s.chg >= 0 ? "up" : "down";
  const headline =
    `${s.sym} is ${dir} ${Math.abs(s.chgPct).toFixed(2)}% today and ${BAND_PHRASE[band]} ` +
    `(composite ${score > 0 ? "+" : ""}${score}). ${reasonFor(s)}`;
  return { band, score, headline };
}
