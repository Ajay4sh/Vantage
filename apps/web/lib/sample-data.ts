// ===== Sample data layer =====
// Direct port of the demo's data.js. This seeds the simulated quote feed and
// stands in for the Upstox-backed module endpoints until each phase lands:
//   quotes (Phase 1, live once UPSTOX_ACCESS_TOKEN is set) -> technicals &
//   fundamentals (Phase 2) -> options (Phase 3) -> news (Phase 4).

import type { Stock } from "./types";

export interface IndexSeed {
  name: string;
  base: number;
  decimals: number;
  prefix: string;
  vol: number;
}

export const SAMPLE_INDICES: IndexSeed[] = [
  { name: "NIFTY 50", base: 24812, decimals: 0, prefix: "", vol: 0.0006 },
  { name: "SENSEX", base: 81460, decimals: 0, prefix: "", vol: 0.0006 },
  { name: "BANK NIFTY", base: 56120, decimals: 0, prefix: "", vol: 0.0008 },
  { name: "NIFTY PSE", base: 9845, decimals: 0, prefix: "", vol: 0.001 },
  { name: "USD/INR", base: 86.42, decimals: 2, prefix: "", vol: 0.0004 },
  { name: "BRENT CRUDE", base: 84.3, decimals: 2, prefix: "$", vol: 0.001 },
];

export const SECTORS = ["All", "Energy", "IT", "Banking", "FMCG"];

export const SAMPLE_STOCKS: Record<string, Stock> = {
  BPCL: {
    sym: "BPCL", name: "Bharat Petroleum Corporation Ltd", sector: "Energy",
    price: 305.0, chg: 1.5, chgPct: 0.49,
    marketCap: "₹1.32L Cr", pe: 5.8, week52: "266.6 – 391.65",
    spark: [298, 302, 296, 300, 308, 312, 305, 309, 301, 305],
    fundamentals: {
      pe: 5.8, roe: 14.2, de: 0.71, eps: 60.49, revGrowth: -3.1,
      divYield: 6.65, opMargin: 4.9, netMargin: 3.1,
      valuationNote: "Trading below long-term average P/E; discount reflects near-term margin pressure rather than a re-rating.",
      capex: "₹25,000 Cr FY27 guidance — ₹11,000 Cr refining, ₹10,000 Cr marketing, ₹2,000-2,500 Cr E&P equity, ₹2,000 Cr city-gas.",
    },
    technicals: {
      trend: "Range-bound, mild downward bias", rsi: 47, macd: "Below signal line",
      support: [298, 285], resistance: [320, 340],
      priceHistory: [284, 291, 296, 289, 298, 305, 312, 308, 300, 296, 301, 309, 315, 306, 300, 298, 305, 310, 303, 305],
      note: "Price is consolidating between the 285-320 band after retreating from the February high of 391.65. No confirmed breakout either side yet.",
    },
    options: {
      expiry: "28-Jul-2026", expiryDate: "2026-07-28", lotSize: 1975, pcr: 0.94, maxPain: 300,
      iv: 38.5,
      ivRank: "Elevated into earnings, historically compresses ~30% post-print",
      strikes: [280, 290, 300, 310, 320, 330],
      callOI: [12000, 18500, 24200, 19800, 14100, 7600],
      putOI: [9800, 15200, 22900, 17300, 11200, 5400],
    },
    news: [
      { h: "Q1 FY27 results due mid-July; brokerages flag elevated crude costs and thinner marketing margins as key swing factors.", tag: "neutral", src: "Sector coverage", when: "This week" },
      { h: "Russian crude sourcing raised to ~40-41% of BPCL's mix, supplies secured through July 2026.", tag: "positive", src: "Sector coverage", when: "Recent" },
      { h: "Multiple brokerages trimmed FY27 target prices after Q4 print citing capex-heavy cycle weighing on return ratios.", tag: "negative", src: "Brokerage notes", when: "Post Q4FY26" },
      { h: "Bina and Kochi petrochemical projects remain key margin catalysts once commissioned; Bina facing delays.", tag: "neutral", src: "Sector coverage", when: "Ongoing" },
    ],
  },
  RELIANCE: {
    sym: "RELIANCE", name: "Reliance Industries Ltd", sector: "Energy",
    price: 2985.0, chg: -12.4, chgPct: -0.41,
    marketCap: "₹20.2L Cr", pe: 24.1, week52: "2,510 – 3,220",
    spark: [2940, 2960, 2955, 2980, 3010, 2995, 2970, 2990, 3000, 2985],
    fundamentals: {
      pe: 24.1, roe: 9.8, de: 0.44, eps: 123.9, revGrowth: 7.4,
      divYield: 0.35, opMargin: 15.2, netMargin: 8.1,
      valuationNote: "Premium valuation reflects retail and Jio growth optionality rather than core refining economics alone.",
      capex: "New energy and telecom capex cycle continues to weigh on near-term free cash flow.",
    },
    technicals: {
      trend: "Uptrend, higher lows intact", rsi: 58, macd: "Above signal line",
      support: [2900, 2820], resistance: [3050, 3220],
      priceHistory: [2880, 2905, 2895, 2920, 2960, 2940, 2975, 3005, 2985, 2960, 2990, 3020, 3040, 3010, 2995, 2970, 2985, 3005, 2995, 2985],
      note: "Holding above the rising 50-day trend line; momentum indicators remain constructive but not overbought.",
    },
    options: {
      expiry: "28-Jul-2026", expiryDate: "2026-07-28", lotSize: 500, pcr: 1.12, maxPain: 2980,
      iv: 22.0,
      ivRank: "Moderate, no major near-term catalyst priced in",
      strikes: [2900, 2940, 2980, 3020, 3060, 3100],
      callOI: [8200, 14300, 21000, 16800, 9900, 5100],
      putOI: [10100, 16800, 23400, 15200, 8700, 4200],
    },
    news: [
      { h: "Jio and retail arms continue to anchor consolidated earnings growth even as O2C margins stay soft.", tag: "positive", src: "Sector coverage", when: "This month" },
      { h: "New energy (solar/battery) capex ramp remains a multi-year overhang on near-term ROCE.", tag: "neutral", src: "Sector coverage", when: "Ongoing" },
    ],
  },
  TCS: {
    sym: "TCS", name: "Tata Consultancy Services Ltd", sector: "IT",
    price: 3620.0, chg: 24.8, chgPct: 0.69,
    marketCap: "₹13.1L Cr", pe: 27.3, week52: "3,180 – 4,050",
    spark: [3560, 3580, 3600, 3590, 3610, 3630, 3605, 3615, 3600, 3620],
    fundamentals: {
      pe: 27.3, roe: 46.2, de: 0.09, eps: 132.6, revGrowth: 5.9,
      divYield: 1.6, opMargin: 24.8, netMargin: 19.1,
      valuationNote: "Premium multiple supported by best-in-class margins and capital return policy, but growth has decelerated from historical highs.",
      capex: "Asset-light model; capex mainly infrastructure and AI/data-centre partnerships.",
    },
    technicals: {
      trend: "Sideways-to-up", rsi: 54, macd: "Flat, near signal line",
      support: [3540, 3450], resistance: [3700, 3800],
      priceHistory: [3520, 3540, 3560, 3555, 3580, 3600, 3590, 3610, 3630, 3615, 3605, 3595, 3610, 3625, 3600, 3615, 3605, 3610, 3600, 3620],
      note: "Consolidating below the 3700 resistance zone; needs a demand-environment catalyst (deal wins, guidance upgrade) to break out.",
    },
    options: {
      expiry: "28-Jul-2026", expiryDate: "2026-07-28", lotSize: 150, pcr: 1.04, maxPain: 3600,
      iv: 19.0,
      ivRank: "Low, typical for a large-cap IT name absent earnings",
      strikes: [3500, 3550, 3600, 3650, 3700, 3750],
      callOI: [6100, 9800, 15200, 11400, 7200, 3800],
      putOI: [5800, 10200, 16400, 10100, 6300, 3100],
    },
    news: [
      { h: "Deal pipeline commentary in focus ahead of quarterly results; BFSI vertical demand remains the key swing factor.", tag: "neutral", src: "Sector coverage", when: "This week" },
      { h: "AI services and GenAI-linked deal wins cited as a structural growth lever by multiple brokerages.", tag: "positive", src: "Brokerage notes", when: "Recent" },
    ],
  },
  HDFCBANK: {
    sym: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Banking",
    price: 1780.0, chg: 8.2, chgPct: 0.46,
    marketCap: "₹13.6L Cr", pe: 19.8, week52: "1,520 – 1,880",
    spark: [1740, 1755, 1760, 1770, 1765, 1780, 1775, 1785, 1770, 1780],
    fundamentals: {
      pe: 19.8, roe: 15.1, de: null, eps: 89.9, revGrowth: 11.2,
      divYield: 1.1, opMargin: null, netMargin: 27.4,
      valuationNote: "Trading close to historical average P/B post-merger digestion; NIM trajectory is the key re-rating trigger.",
      capex: "Branch expansion and digital infrastructure investment ongoing.",
    },
    technicals: {
      trend: "Steady uptrend", rsi: 61, macd: "Above signal line",
      support: [1740, 1680], resistance: [1820, 1880],
      priceHistory: [1700, 1715, 1725, 1720, 1735, 1750, 1745, 1760, 1755, 1770, 1765, 1775, 1780, 1770, 1775, 1785, 1775, 1780, 1775, 1780],
      note: "Grinding higher within a well-defined channel; deposit growth and NIM commentary are the main watch items.",
    },
    options: {
      expiry: "28-Jul-2026", expiryDate: "2026-07-28", lotSize: 550, pcr: 1.18, maxPain: 1780,
      iv: 17.5,
      ivRank: "Moderate",
      strikes: [1700, 1740, 1780, 1820, 1860, 1900],
      callOI: [9200, 13400, 19800, 15100, 8600, 4300],
      putOI: [11400, 16200, 21900, 13800, 7100, 3600],
    },
    news: [
      { h: "Deposit mobilisation and NIM stability remain the central themes ahead of quarterly numbers.", tag: "neutral", src: "Sector coverage", when: "This week" },
      { h: "Analysts broadly constructive on credit growth normalisation post-merger integration.", tag: "positive", src: "Brokerage notes", when: "Recent" },
    ],
  },
  INFY: {
    sym: "INFY", name: "Infosys Ltd", sector: "IT",
    price: 1615.0, chg: -6.3, chgPct: -0.39,
    marketCap: "₹6.7L Cr", pe: 24.6, week52: "1,420 – 1,780",
    spark: [1630, 1625, 1640, 1620, 1610, 1625, 1615, 1600, 1610, 1615],
    fundamentals: {
      pe: 24.6, roe: 31.4, de: 0.06, eps: 65.7, revGrowth: 4.8,
      divYield: 2.4, opMargin: 21.3, netMargin: 17.2,
      valuationNote: "In line with sector average; growth premium has compressed as revenue growth normalises to mid-single digits.",
      capex: "Asset-light; incremental spend on AI platforms (Topaz) and reskilling.",
    },
    technicals: {
      trend: "Mild downtrend", rsi: 42, macd: "Below signal line",
      support: [1590, 1540], resistance: [1660, 1720],
      priceHistory: [1660, 1650, 1645, 1635, 1640, 1620, 1630, 1610, 1625, 1615, 1605, 1620, 1610, 1600, 1615, 1610, 1600, 1610, 1605, 1615],
      note: "Underperforming the broader IT pack over the last month; watching the 1590 support for a base to form.",
    },
    options: {
      expiry: "28-Jul-2026", expiryDate: "2026-07-28", lotSize: 400, pcr: 0.88, maxPain: 1620,
      iv: 24.5,
      ivRank: "Moderate, skewed toward puts",
      strikes: [1540, 1580, 1620, 1660, 1700, 1740],
      callOI: [5400, 8900, 13200, 10100, 6300, 3200],
      putOI: [7100, 10800, 15600, 9200, 5100, 2400],
    },
    news: [
      { h: "Guidance commentary on discretionary IT spend recovery will be closely watched this earnings season.", tag: "neutral", src: "Sector coverage", when: "This week" },
      { h: "Margin pressure from wage hikes flagged as a near-term drag by some brokerages.", tag: "negative", src: "Brokerage notes", when: "Recent" },
    ],
  },
  ITC: {
    sym: "ITC", name: "ITC Ltd", sector: "FMCG",
    price: 428.0, chg: 2.1, chgPct: 0.49,
    marketCap: "₹5.35L Cr", pe: 22.9, week52: "390 – 480",
    spark: [418, 420, 424, 422, 426, 430, 427, 425, 426, 428],
    fundamentals: {
      pe: 22.9, roe: 27.8, de: 0.02, eps: 18.7, revGrowth: 6.1,
      divYield: 3.4, opMargin: 33.6, netMargin: 27.9,
      valuationNote: "Reasonable multiple for a cash-generative FMCG-cigarettes hybrid; regulatory/tax risk on tobacco is the main overhang.",
      capex: "FMCG and hotels demerger-related capex normalised; steady dividend payout policy.",
    },
    technicals: {
      trend: "Gentle uptrend", rsi: 55, macd: "Above signal line",
      support: [415, 400], resistance: [440, 460],
      priceHistory: [405, 408, 412, 410, 415, 418, 416, 420, 422, 419, 424, 426, 423, 425, 428, 426, 424, 427, 426, 428],
      note: "Steady grind higher, low volatility relative to the broader market — typical of the defensive FMCG cohort.",
    },
    options: {
      expiry: "28-Jul-2026", expiryDate: "2026-07-28", lotSize: 1600, pcr: 1.02, maxPain: 425,
      iv: 14.0,
      ivRank: "Low",
      strikes: [400, 410, 420, 430, 440, 450],
      callOI: [7200, 10400, 14800, 11200, 7100, 3900],
      putOI: [7600, 10900, 14200, 10800, 6700, 3400],
    },
    news: [
      { h: "Cigarette taxation policy remains the key regulatory watch item into the union budget cycle.", tag: "neutral", src: "Sector coverage", when: "Ongoing" },
      { h: "FMCG portfolio (foods, personal care) continues steady double-digit segment growth.", tag: "positive", src: "Sector coverage", when: "Recent" },
    ],
  },
};

export const DEFAULT_SYMBOL = "BPCL";
