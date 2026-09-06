// Market Pulse mood engine. Computes the sentiment-led "front door" snapshot
// honestly from real signals — index movement + composite conviction — never
// an invented or exaggerated reading. Calm days render calm (neutral/gold).
// Language here describes what happened; it never predicts.
//
// Pure functions, unit-tested in tests/pulse.test.ts. The /api/pulse route
// feeds real (or simulated) stock + index data in.

import { computeConviction } from "./conviction";
import type { IndexQuote, Stock } from "./types";

export type Mood = "bullish" | "neutral" | "bearish";

export const MOOD_COLOR: Record<Mood, string> = {
  bullish: "#35B08B",
  neutral: "#D4A73C",
  bearish: "#E0616B",
};

export const MOOD_WORD: Record<Mood, string> = {
  bullish: "Bullish",
  neutral: "Neutral",
  bearish: "Bearish",
};

// Tide/heartbeat waves (not stock charts), one gesture per mood. viewBox 0 0 350 90.
export const MOOD_WAVE: Record<Mood, string> = {
  bullish:
    "M0,72 C40,50 60,18 90,18 C120,18 130,66 160,66 C190,66 200,28 230,24 C260,20 270,58 300,54 C320,51 335,58 350,56",
  neutral:
    "M0,70 C40,70 40,50 80,50 C120,50 120,90 160,90 C200,90 200,55 240,55 C270,55 280,75 310,72 C330,70 340,70 350,70",
  bearish:
    "M0,26 C40,34 60,20 90,26 C120,32 130,52 160,54 C190,56 200,44 230,50 C260,56 270,72 300,72 C320,72 335,76 350,78",
};

/** The six sectors the Pulse surface covers, and the symbols that represent
 *  each. The first symbol is the sector's "lead" name for copy. */
export const PULSE_SECTORS: { name: string; symbols: string[] }[] = [
  { name: "Banking", symbols: ["HDFCBANK"] },
  { name: "IT", symbols: ["TCS", "INFY"] },
  { name: "FMCG", symbols: ["ITC"] },
  { name: "Energy", symbols: ["BPCL", "RELIANCE"] },
  { name: "Auto", symbols: ["TATAMOTORS"] },
  { name: "Pharma", symbols: ["SUNPHARMA"] },
];

/** Blend a stock's composite conviction with its day change into one score,
 *  so both "how it's priced" and "how it moved" count. */
function stockScore(s: Stock): number {
  const conv = computeConviction(s).score; // -100..100
  const chg = Math.max(-4, Math.min(4, s.chgPct)) * 12; // ±48 cap
  return conv * 0.6 + chg * 0.4;
}

export function moodFromScore(score: number): Mood {
  if (score > 12) return "bullish";
  if (score < -12) return "bearish";
  return "neutral";
}

export interface SectorMood {
  name: string;
  mood: Mood;
  color: string;
  lead: string; // lead ticker
  summary: string;
}

function sectorSummary(name: string, mood: Mood, lead: string): string {
  switch (mood) {
    case "bullish":
      return `${name} names climbing — ${lead} leading the move.`;
    case "bearish":
      return `${name} under pressure — ${lead} weighing on the group.`;
    default:
      return `${name} mixed — ${lead} holding steady.`;
  }
}

export function computeSectorMood(name: string, stocks: Stock[]): SectorMood {
  const present = stocks.filter(Boolean);
  const avg = present.length ? present.reduce((a, s) => a + stockScore(s), 0) / present.length : 0;
  const mood = moodFromScore(avg);
  const lead = present[0]?.sym ?? name.toUpperCase();
  return { name, mood, color: MOOD_COLOR[mood], lead, summary: sectorSummary(name, mood, lead) };
}

export interface MarketPulse {
  mood: Mood;
  color: string;
  word: string;
  wave: string;
  headline: string;
  indices: { name: string; value: string; changePct: number }[];
  story: { title: string; body: string; sector: string; mood: Mood };
  sectors: SectorMood[];
  asOf: string;
}

/** Headline does the emotional work but stays honest — it names the real
 *  strongest and weakest sectors of the day. */
function headlineFor(mood: Mood, top: SectorMood, bottom: SectorMood): string {
  if (mood === "bullish") return `Markets are upbeat today, ${top.name} strength leading the move`;
  if (mood === "bearish") return `Markets are under pressure today, ${bottom.name} stocks weighing heaviest`;
  return `Markets are mixed today, ${top.name} strength offsetting ${bottom.name} weakness`;
}

/** One editorial story a day — the notable thing, not a leaderboard. Built
 *  from the sector that moved most decisively. */
function storyFor(sectors: SectorMood[]): MarketPulse["story"] {
  const ranked = [...sectors].sort((a, b) => moodRank(b.mood) - moodRank(a.mood));
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];
  // Prefer the more emphatic side as the day's story.
  const feature = Math.abs(moodRank(weakest.mood)) >= moodRank(strongest.mood) ? weakest : strongest;
  const dir = feature.mood === "bearish" ? "lower" : feature.mood === "bullish" ? "higher" : "sideways";
  const title = `${feature.name} stocks lead the market ${dir}`;
  const body =
    feature.mood === "bearish"
      ? `${feature.name} names slipped as ${feature.lead} and its peers led the pullback, even as the broader market held its footing — a sector story, not a market one.`
      : feature.mood === "bullish"
        ? `${feature.name} names firmed up with ${feature.lead} out front, doing much of the day's lifting while the rest of the market drifted.`
        : `${feature.name} traded quietly around ${feature.lead}, with no decisive move either way — a calm session for the group.`;
  return { title, body, sector: feature.name, mood: feature.mood };
}

function moodRank(m: Mood): number {
  return m === "bullish" ? 1 : m === "bearish" ? -2 : 0;
}

export interface PulseInput {
  stocksBySymbol: Record<string, Stock>;
  indices: IndexQuote[];
}

export function computeMarketPulse(input: PulseInput): MarketPulse {
  const sectors = PULSE_SECTORS.map((def) =>
    computeSectorMood(
      def.name,
      def.symbols.map((sym) => input.stocksBySymbol[sym]).filter((s): s is Stock => !!s),
    ),
  );

  // Headline picks real extremes.
  const byScore = [...sectors].sort((a, b) => moodRank(b.mood) - moodRank(a.mood));
  const top = byScore[0];
  const bottom = byScore[byScore.length - 1];

  // Market mood: index move is the anchor, conviction breadth the tiebreak.
  const idxAvg =
    input.indices.length > 0
      ? input.indices.filter((i) => i.decimals === 0).reduce((a, i) => a + i.changePct, 0) /
        Math.max(1, input.indices.filter((i) => i.decimals === 0).length)
      : 0;
  const bullCount = sectors.filter((s) => s.mood === "bullish").length;
  const bearCount = sectors.filter((s) => s.mood === "bearish").length;
  const marketScore = idxAvg * 45 + (bullCount - bearCount) * 6;
  const mood = moodFromScore(marketScore);

  const headline = headlineFor(mood, top, bottom);
  const story = storyFor(sectors);

  const wanted = ["NIFTY 50", "SENSEX"];
  const indices = wanted
    .map((name) => input.indices.find((i) => i.name === name))
    .filter((i): i is IndexQuote => !!i)
    .map((i) => ({
      name: i.name,
      value: Math.round(i.value).toLocaleString("en-IN"),
      changePct: i.changePct,
    }));

  return {
    mood,
    color: MOOD_COLOR[mood],
    word: MOOD_WORD[mood],
    wave: MOOD_WAVE[mood],
    headline,
    indices,
    story,
    sectors,
    asOf: new Date().toISOString(),
  };
}

/** Curiosity-framed onboarding cards — descriptive hooks about the company,
 *  never prices or returns (content guardrail). */
export interface OnboardCard {
  ticker: string;
  name: string;
  sector: string;
  hook: string;
}

export const ONBOARD_CARDS: OnboardCard[] = [
  { ticker: "HDFCBANK", name: "HDFC Bank", sector: "Banking", hook: "India's largest private bank — the one most portfolios start with." },
  { ticker: "TCS", name: "Tata Consultancy Services", sector: "IT", hook: "The country's biggest IT exporter, and a bellwether for the whole sector." },
  { ticker: "INFY", name: "Infosys", sector: "IT", hook: "The other IT giant — a barometer for global tech-spending appetite." },
  { ticker: "ITC", name: "ITC Limited", sector: "FMCG", hook: "Cigarettes-to-biscuits conglomerate — a classic defensive, dividend name." },
  { ticker: "RELIANCE", name: "Reliance Industries", sector: "Energy", hook: "The country's biggest company — energy, telecom, and retail under one roof." },
  { ticker: "BPCL", name: "Bharat Petroleum", sector: "Energy", hook: "A state-run refiner — its fortunes track crude and refining margins." },
  { ticker: "TATAMOTORS", name: "Tata Motors", sector: "Auto", hook: "Maker of Indian trucks and Jaguar Land Rover — a global auto play." },
  { ticker: "SUNPHARMA", name: "Sun Pharmaceutical", sector: "Pharma", hook: "India's largest drugmaker, with a big US generics business." },
];
