// Phase 2: technical indicators computed server-side from daily candles, so
// /api/technicals can serve the same shape the demo hardcoded. Pure functions,
// unit-tested in tests/technicals.test.ts — these break silently if fed a
// malformed series, so keep them covered.

import type { Candle, Technicals } from "./types";

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Simple moving average of the last `period` values (or all, if fewer). */
export function sma(values: number[], period: number): number {
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** EMA series aligned to `values`; entries before index period-1 are NaN. */
export function emaSeries(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length < period) return out;
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = e;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}

/** Simple moving average as a full series aligned to `values`; entries before
 *  index period-1 are null. For chart overlays (Phase 12 candlestick chart). */
export function smaSeries(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += values[j];
    return Math.round((s / period) * 100) / 100;
  });
}

export interface BollingerPoint {
  mid: number | null;
  upper: number | null;
  lower: number | null;
}

/** Bollinger Bands: `mult`-sigma envelope around the `period`-SMA. Population
 *  standard deviation over the window (the usual convention). Pure; for the
 *  Phase 12 chart overlay. */
export function bollingerBands(values: number[], period = 20, mult = 2): BollingerPoint[] {
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return values.map((_, i) => {
    if (i < period - 1) return { mid: null, upper: null, lower: null };
    const win = values.slice(i - period + 1, i + 1);
    const mean = win.reduce((a, b) => a + b, 0) / period;
    const variance = win.reduce((a, b) => a + (b - mean) * (b - mean), 0) / period;
    const sd = Math.sqrt(variance);
    return { mid: r2(mean), upper: r2(mean + mult * sd), lower: r2(mean - mult * sd) };
  });
}

/** RSI with Wilder's smoothing. Returns a 0-100 integer; 50 when the series
 *  is too short or perfectly flat (no signal either way). */
export function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    gain += Math.max(0, diff);
    loss += Math.max(0, -diff);
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period;
  }
  if (avgGain === 0 && avgLoss === 0) return 50;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - 100 / (1 + rs));
}

export interface MacdResult {
  value: number;
  signal: number;
  label: string;
}

/** MACD(12,26,9). Label matches the demo's vocabulary ("Above/Below signal
 *  line", "Flat, near signal line") since the UI and note generator print it. */
export function computeMACD(closes: number[]): MacdResult {
  if (closes.length < 26 + 9) {
    return { value: 0, signal: 0, label: "Insufficient history" };
  }
  const e12 = emaSeries(closes, 12);
  const e26 = emaSeries(closes, 26);
  const macdSeries: number[] = [];
  for (let i = 25; i < closes.length; i++) macdSeries.push(e12[i] - e26[i]);
  const signalSeries = emaSeries(macdSeries, 9);
  const value = macdSeries[macdSeries.length - 1];
  const signal = signalSeries[signalSeries.length - 1];
  const eps = closes[closes.length - 1] * 0.0005; // "near" = within 5bps of price
  const label =
    value > signal + eps ? "Above signal line" : value < signal - eps ? "Below signal line" : "Flat, near signal line";
  return { value, signal, label };
}

/** Trend classification off the 20/50-day averages. Wording matters: the
 *  conviction scorer keys off lowercase "up"/"down" substrings. */
export function classifyTrend(closes: number[]): string {
  const last = closes[closes.length - 1];
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  if (last > s20 && s20 > s50) return "Uptrend — price above 20/50-day averages";
  if (last < s20 && s20 < s50) return "Downtrend — price below 20/50-day averages";
  return "Sideways / range-bound";
}

/** Two nearest support (swing lows below spot) and resistance (swing highs
 *  above spot) levels from the last `lookback` sessions. */
export function findSupportResistance(
  candles: Candle[],
  lookback = 60,
  wing = 3,
): { support: number[]; resistance: number[] } {
  const recent = candles.slice(-lookback);
  const close = recent[recent.length - 1].close;

  const swingLows: number[] = [];
  const swingHighs: number[] = [];
  for (let i = wing; i < recent.length - wing; i++) {
    let isLow = true;
    let isHigh = true;
    for (let j = i - wing; j <= i + wing; j++) {
      if (j === i) continue;
      if (recent[j].low < recent[i].low) isLow = false;
      if (recent[j].high > recent[i].high) isHigh = false;
    }
    if (isLow) swingLows.push(recent[i].low);
    if (isHigh) swingHighs.push(recent[i].high);
  }

  let support = Array.from(new Set(swingLows.filter((v) => v < close)))
    .sort((a, b) => b - a)
    .slice(0, 2);
  let resistance = Array.from(new Set(swingHighs.filter((v) => v > close)))
    .sort((a, b) => a - b)
    .slice(0, 2);
  if (support.length === 0) support = [Math.min(...recent.map((c) => c.low))];
  if (resistance.length === 0) resistance = [Math.max(...recent.map((c) => c.high))];
  return { support: support.map(round2), resistance: resistance.map(round2) };
}

/** Assemble the full Technicals block (same shape the demo hardcoded) from
 *  oldest-first daily candles. */
export function buildTechnicals(candles: Candle[]): Technicals {
  if (candles.length < 30) {
    throw new Error(`Not enough candle history to compute technicals (${candles.length} bars, need 30+)`);
  }
  const closes = candles.map((c) => c.close);
  const last = closes[closes.length - 1];
  const rsi = computeRSI(closes);
  const macd = computeMACD(closes);
  const trend = classifyTrend(closes);
  const { support, resistance } = findSupportResistance(candles);
  const s20 = round2(sma(closes, 20));

  const rsiContext = rsi >= 70 ? " (overbought territory)" : rsi <= 30 ? " (oversold territory)" : "";
  const note =
    `Computed from ${candles.length} daily candles. Close ${last > s20 ? "above" : "below"} the 20-day average ` +
    `(₹${s20}); nearest support ₹${support[0]}, resistance ₹${resistance[0]}. RSI ${rsi}${rsiContext}.`;

  return {
    trend,
    rsi,
    macd: macd.label,
    support,
    resistance,
    priceHistory: closes.slice(-20).map(round2),
    note,
  };
}

export { round1, round2 };
