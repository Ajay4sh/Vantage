// Phase 4 — headline sentiment tagging. Upstox doesn't provide sentiment, so
// we classify headlines ourselves (build instructions §2). Two paths, same
// env-gated pattern as the rest of the app:
//   • ANTHROPIC_API_KEY set  → one Claude call classifies the batch.
//   • otherwise              → a transparent keyword heuristic, so the demo
//                              still produces reasonable tags with no key.
//
// The classifier is deliberately a single API call over the whole batch
// (classification is the simplest LLM tier — one request, one response).

import Anthropic from "@anthropic-ai/sdk";
import type { SentimentTag } from "./types";

// Default to the most capable model; override with ANTHROPIC_MODEL (e.g.
// claude-haiku-4-5 for cheaper bulk classification — a cost choice that's the
// operator's to make).
function model(): string {
  return process.env.ANTHROPIC_MODEL || "claude-opus-5";
}

export function sentimentConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// ===== Keyword heuristic (no-key fallback) =====

const POSITIVE = [
  "surge", "surges", "gain", "gains", "rise", "rises", "rose", "jump", "jumps", "beat", "beats",
  "upgrade", "upgraded", "record", "profit", "profits", "growth", "grew", "strong", "strength",
  "outperform", "rally", "rallies", "bullish", "boost", "boosts", "wins", "won", "approval", "approved",
  "higher", "expansion", "recovery", "optimistic", "raise", "raised", "tops",
];
const NEGATIVE = [
  "slip", "slips", "slipped", "fall", "falls", "fell", "drop", "drops", "decline", "declines", "miss", "misses",
  "downgrade", "downgraded", "loss", "losses", "weak", "weakness", "cut", "cuts", "pressure", "plunge", "plunges",
  "bearish", "concern", "concerns", "warn", "warns", "warning", "lawsuit", "probe", "fine", "penalty",
  "lower", "slump", "selloff", "sell-off", "trim", "trimmed", "delays", "delay", "headwind", "headwinds",
];

/** Transparent word-count sentiment: net positive vs negative keyword hits. */
export function heuristicTag(headline: string): SentimentTag {
  const words = headline.toLowerCase().match(/[a-z-]+/g) ?? [];
  let score = 0;
  for (const w of words) {
    if (POSITIVE.includes(w)) score += 1;
    if (NEGATIVE.includes(w)) score -= 1;
  }
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}

// ===== Claude classifier =====

const VALID: SentimentTag[] = ["positive", "neutral", "negative"];

/** Classify a batch of headlines for a retail investor reading about `ticker`.
 *  Falls back to the heuristic per-headline on any error, so a classifier
 *  hiccup never drops the news module. */
export async function classifyHeadlines(headlines: string[], ticker: string): Promise<SentimentTag[]> {
  if (headlines.length === 0) return [];
  if (!sentimentConfigured()) return headlines.map(heuristicTag);

  try {
    const client = new Anthropic();
    const numbered = headlines.map((h, i) => `${i + 1}. ${h}`).join("\n");
    const res = await client.messages.create({
      model: model(),
      max_tokens: 1024,
      system:
        "You classify Indian equity news headlines by sentiment for a retail investor. " +
        "Reply with sentiment only — never advice. positive = good news for the stock, " +
        "negative = bad news, neutral = mixed or purely factual.",
      messages: [
        {
          role: "user",
          content: `Classify each headline about ${ticker} as positive, neutral, or negative:\n\n${numbered}`,
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["tags"],
            properties: {
              tags: {
                type: "array",
                items: { type: "string", enum: VALID },
              },
            },
          },
        },
      },
    } as Anthropic.MessageCreateParamsNonStreaming);

    const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "{}";
    const parsed = JSON.parse(text) as { tags?: unknown };
    const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
    // Align to the input length; fall back to heuristic for any missing/invalid entry.
    return headlines.map((h, i) => {
      const t = tags[i];
      return typeof t === "string" && (VALID as string[]).includes(t) ? (t as SentimentTag) : heuristicTag(h);
    });
  } catch (err) {
    console.error("sentiment: Claude classification failed, using heuristic:", err);
    return headlines.map(heuristicTag);
  }
}
