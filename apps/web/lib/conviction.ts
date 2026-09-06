// Ported from the demo's app.js. Runs on both client and server (Phase 5
// moves note persistence server-side; the math itself is shared).

import type { Conviction, ConvictionDriver, ImpliedMove, OptionsAnalytics, Stock } from "./types";

// ===== Conviction score (composite of the four modules) =====
export function computeConviction(s: Stock): Conviction {
  // Simple transparent scoring model — every input is visible in the UI,
  // nothing here is a black box. Each driver contributes -100..+100, averaged.
  const drivers: ConvictionDriver[] = [];

  // Fundamentals: reward positive revenue growth, penalise very high leverage.
  // Null-tolerant: a metric the live API doesn't provide contributes 0 rather
  // than silently coercing (null >= 0 is true in JS — never let that happen).
  let fundScore = 0;
  if (s.fundamentals.revGrowth != null) fundScore += s.fundamentals.revGrowth >= 0 ? 20 : -20;
  if (s.fundamentals.roe != null) fundScore += s.fundamentals.roe >= 15 ? 15 : s.fundamentals.roe >= 8 ? 0 : -15;
  drivers.push({ name: "Fundamentals", score: fundScore });

  // Technicals: trend + RSI positioning
  let techScore = 0;
  if (s.technicals.trend.toLowerCase().includes("up")) techScore += 25;
  else if (s.technicals.trend.toLowerCase().includes("down")) techScore -= 25;
  if (s.technicals.rsi > 60) techScore += 10;
  else if (s.technicals.rsi < 40) techScore -= 10;
  drivers.push({ name: "Technicals", score: techScore });

  // Options: PCR above 1 = more put writing = bullish read (classic convention); below 1 = bearish tilt
  let optScore = (s.options.pcr - 1) * 60;
  optScore = Math.max(-30, Math.min(30, optScore));
  drivers.push({ name: "Options positioning", score: Math.round(optScore) });

  // News sentiment
  const posCount = s.news.filter((n) => n.tag === "positive").length;
  const negCount = s.news.filter((n) => n.tag === "negative").length;
  let newsScore = (posCount - negCount) * 15;
  newsScore = Math.max(-30, Math.min(30, newsScore));
  drivers.push({ name: "News sentiment", score: newsScore });

  const total = drivers.reduce((a, d) => a + d.score, 0);
  const avg = Math.round(total / drivers.length);
  return { score: avg, drivers };
}

// ===== Implied move calculator =====
// Standard options-market convention: expected move = Price x IV x sqrt(DTE/365)
// This gives a 1-standard-deviation range (~68% probability of landing inside it
// under the model's lognormal-ish assumption -- a market-implied probability
// band, not a directional forecast).
export function computeImpliedMove(s: Stock): ImpliedMove {
  const o = s.options;
  const expiry = new Date(o.expiryDate + "T15:30:00");
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const dte = Math.max(1, Math.ceil((expiry.getTime() - now.getTime()) / msPerDay));
  const ivDecimal = o.iv / 100;
  const oneSD = s.price * ivDecimal * Math.sqrt(dte / 365);
  const twoSD = oneSD * 2;
  return {
    dte,
    oneSD,
    range68: [s.price - oneSD, s.price + oneSD],
    range95: [s.price - twoSD, s.price + twoSD],
  };
}

// Structural labels for the research note, per locale. Only the template
// scaffolding is translated — tickers, numbers, and financial abbreviations
// (P/E, ROE, RSI, PCR…) stay in standard English notation (build prompt 8.3).
type NoteLocale = "en" | "hi";
const NOTE_LABELS: Record<NoteLocale, Record<string, string>> = {
  en: {
    title: "RESEARCH NOTE",
    generated: "Generated",
    sample: "Sample data, for demonstration only",
    price: "Price",
    marketCap: "Market cap",
    range52: "52W range",
    conviction: "CONVICTION SCORE",
    fundamentals: "FUNDAMENTALS",
    technicals: "TECHNICALS",
    options: "OPTIONS",
    expiry: "expiry",
    signals: "Signals (market positioning, not advice):",
    news: "NEWS & SENTIMENT",
    disc1: "This note is compiled from sample/demo data for platform illustration.",
    disc2: "Not investment advice. Not SEBI-registered research. Verify all",
    disc3: "figures against live sources and consult a qualified advisor before",
    disc4: "acting on any position.",
  },
  hi: {
    title: "रिसर्च नोट",
    generated: "तैयार किया गया",
    sample: "नमूना डेटा, केवल प्रदर्शन के लिए",
    price: "कीमत",
    marketCap: "मार्केट कैप",
    range52: "52 सप्ताह रेंज",
    conviction: "समग्र स्कोर",
    fundamentals: "फंडामेंटल्स",
    technicals: "टेक्निकल्स",
    options: "ऑप्शंस",
    expiry: "एक्सपायरी",
    signals: "संकेत (बाज़ार पोज़िशनिंग, सलाह नहीं):",
    news: "समाचार और सेंटिमेंट",
    disc1: "यह नोट प्लेटफ़ॉर्म प्रदर्शन के लिए नमूना/डेमो डेटा से बना है।",
    disc2: "निवेश सलाह नहीं। SEBI-पंजीकृत रिसर्च नहीं। किसी भी पोज़िशन पर",
    disc3: "कार्रवाई से पहले सभी आंकड़े लाइव स्रोतों से सत्यापित करें और",
    disc4: "किसी योग्य सलाहकार से परामर्श करें।",
  },
};

// ===== Research note generator =====
export function generateNote(s: Stock, analytics?: OptionsAnalytics, locale: NoteLocale = "en"): string {
  const L = NOTE_LABELS[locale] ?? NOTE_LABELS.en;
  const conv = computeConviction(s);
  const f = s.fundamentals,
    t = s.technicals,
    o = s.options;
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `${L.title} — ${s.sym} (${s.name})`,
    `${L.generated} ${date} | ${L.sample}`,
    `${"-".repeat(46)}`,
    ``,
    `${L.price}: Rs.${s.price.toFixed(2)}  (${s.chg >= 0 ? "+" : ""}${s.chg.toFixed(2)}, ${s.chg >= 0 ? "+" : ""}${s.chgPct.toFixed(2)}%)`,
    `${L.marketCap}: ${s.marketCap}  |  P/E: ${f.pe ?? "n/a"}  |  ${L.range52}: ${s.week52}`,
    ``,
    `${L.conviction}: ${conv.score > 0 ? "+" : ""}${conv.score} / 100`,
    ...conv.drivers.map((d) => `  - ${d.name}: ${d.score > 0 ? "+" : ""}${d.score}`),
    ``,
    `${L.fundamentals}`,
    `  ROE ${f.roe != null ? `${f.roe}%` : "n/a"} | D/E ${f.de ?? "n/a"} | Rev growth ${
      f.revGrowth != null ? `${f.revGrowth >= 0 ? "+" : ""}${f.revGrowth}%` : "n/a"
    } | Div yield ${f.divYield != null ? `${f.divYield}%` : "n/a"}`,
    `  ${f.valuationNote}`,
    ``,
    `${L.technicals}`,
    `  Trend: ${t.trend} | RSI: ${t.rsi} | MACD: ${t.macd}`,
    `  Support: Rs.${t.support.join(" / Rs.")}  Resistance: Rs.${t.resistance.join(" / Rs.")}`,
    `  ${t.note}`,
    ``,
    `${L.options} (${o.expiry} ${L.expiry})`,
    `  PCR: ${o.pcr} | Max pain: Rs.${o.maxPain} | Lot size: ${o.lotSize}`,
    `  ${o.ivRank}`,
    ...(analytics
      ? [
          `  ${L.signals}`,
          ...analytics.signals.map((sig) => `    - ${sig.name}: ${sig.state} — ${sig.detail}`),
        ]
      : []),
    ``,
    `${L.news}`,
    ...s.news.map((n) => `  [${n.tag.toUpperCase()}] ${n.h}`),
    ``,
    `${"-".repeat(46)}`,
    L.disc1,
    L.disc2,
    L.disc3,
    L.disc4,
  ];
  return lines.join("\n");
}
