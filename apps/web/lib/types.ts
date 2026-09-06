export type SentimentTag = "positive" | "neutral" | "negative";

export interface NewsItem {
  h: string;
  tag: SentimentTag;
  src: string;
  when: string;
}

// Every ratio is nullable: the live Upstox key-ratios endpoint only covers
// P/E, P/B, ROA/ROE/ROCE and EV/EBITDA, so D/E and dividend yield (and any
// field an upstream response omits) render as "—" until a richer source
// (screener.in/Tijori fallback) is wired in.
export interface Fundamentals {
  pe: number | null;
  roe: number | null;
  de: number | null;
  eps: number | null;
  revGrowth: number | null;
  divYield: number | null;
  opMargin: number | null;
  netMargin: number | null;
  valuationNote: string;
  capex: string;
}

export interface Technicals {
  trend: string;
  rsi: number;
  macd: string;
  support: number[];
  resistance: number[];
  priceHistory: number[];
  note: string;
}

export interface OptionsData {
  expiry: string;
  expiryDate: string; // ISO date, used for DTE in the implied-move calc
  lotSize: number;
  pcr: number;
  maxPain: number;
  iv: number; // flat ATM IV in % — Phase 3 swaps this for per-strike IV
  ivRank: string;
  strikes: number[];
  callOI: number[];
  putOI: number[];
}

export interface Stock {
  sym: string;
  name: string;
  sector: string;
  /** "index" gets no fundamentals and weekly option expiries; defaults to "equity". */
  kind?: "equity" | "index";
  price: number;
  chg: number;
  chgPct: number;
  marketCap: string;
  pe: number | null;
  week52: string;
  spark: number[];
  fundamentals: Fundamentals;
  technicals: Technicals;
  options: OptionsData;
  news: NewsItem[];
}

/** One OHLCV bar from the Upstox Historical Candle API, oldest-first once parsed. */
export interface Candle {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndexQuote {
  name: string;
  prefix: string;
  decimals: number;
  value: number;
  changePct: number;
}

/** Per-symbol payload from /api/quotes. `options` only present while the
 *  simulated feed also nudges OI — a live feed sends prices only. */
export interface QuoteUpdate {
  price: number;
  chg: number;
  chgPct: number;
  options?: {
    callOI: number[];
    putOI: number[];
    pcr: number;
  };
}

export type QuoteSource = "simulated" | "live";

export interface QuotesResponse {
  source: QuoteSource;
  asOf: string;
  indices: IndexQuote[];
  quotes: Record<string, QuoteUpdate>;
}

// ===== Options analytics (Phase 3) =====

export type SignalTone = "pos" | "neg" | "neu";

/** One discrete signal readout. `state` is the short label shown in the badge
 *  ("Bullish tilt", "Rich", "Pinned"...), `detail` the one-line explanation
 *  with the numbers that produced it. Signals describe what the options
 *  market is pricing — they are never trade advice. */
export interface OptionsSignal {
  name: string;
  state: string;
  tone: SignalTone;
  detail: string;
}

export interface GreeksRow {
  strike: number;
  iv: number;
  callDelta: number;
  putDelta: number;
  gamma: number;
  callTheta: number;
  vega: number;
  atm: boolean;
}

export interface OptionsAnalytics {
  source: "sample" | "live";
  spot: number;
  expiry: string;
  dte: number;
  pcr: number;
  maxPain: number;
  oiSupport: number; // strike carrying the heaviest put OI
  oiResistance: number; // strike carrying the heaviest call OI
  rv20: number | null; // 20-session realized volatility, annualized %
  ivAtm: number; // ATM implied volatility %
  ivPremiumPct: number | null; // how rich IV is vs realized, in %
  skewPts: number | null; // avg OTM put IV minus avg OTM call IV, vol points
  greeks: GreeksRow[];
  signals: OptionsSignal[];
  score: number; // -100..100 net positioning score, used by the radar ranking
}

/** Per-symbol row for the F&O radar table. */
export interface RadarEntry {
  sym: string;
  pcr: number;
  ivAtm: number;
  rv20: number | null;
  ivPremiumPct: number | null;
  positioning: string;
  tone: SignalTone;
  volState: string;
  score: number;
}

export interface ConvictionDriver {
  name: string;
  score: number;
}

export interface Conviction {
  score: number;
  drivers: ConvictionDriver[];
}

export interface ImpliedMove {
  dte: number;
  oneSD: number;
  range68: [number, number];
  range95: [number, number];
}
