// Phase 12 (Gap 2) — the scan universe. With live Upstox credentials this would
// draw on the cached OHLC of the tracked universe; credential-free it's a
// curated set of ~30 liquid NSE names with deterministic, market-realistic
// synthesized candles. Clearly not live data (the UI says so) — the dispersion
// here (movers, gaps, volume spikes, names near their highs) exists so each
// scanner has something real to demonstrate, not to imply a real signal.

import { SAMPLE_STOCKS } from "../sample-data";
import { synthSpot } from "../synth";
import type { Candle } from "../types";
import type { ScanInput } from "./types";

const UNIVERSE: { sym: string; name: string; sector: string }[] = [
  { sym: "RELIANCE", name: "Reliance Industries", sector: "Energy" },
  { sym: "BPCL", name: "Bharat Petroleum", sector: "Energy" },
  { sym: "ONGC", name: "Oil & Natural Gas Corp", sector: "Energy" },
  { sym: "IOC", name: "Indian Oil Corp", sector: "Energy" },
  { sym: "TCS", name: "Tata Consultancy Services", sector: "IT" },
  { sym: "INFY", name: "Infosys", sector: "IT" },
  { sym: "WIPRO", name: "Wipro", sector: "IT" },
  { sym: "HCLTECH", name: "HCL Technologies", sector: "IT" },
  { sym: "TECHM", name: "Tech Mahindra", sector: "IT" },
  { sym: "HDFCBANK", name: "HDFC Bank", sector: "Banking" },
  { sym: "ICICIBANK", name: "ICICI Bank", sector: "Banking" },
  { sym: "SBIN", name: "State Bank of India", sector: "Banking" },
  { sym: "AXISBANK", name: "Axis Bank", sector: "Banking" },
  { sym: "KOTAKBANK", name: "Kotak Mahindra Bank", sector: "Banking" },
  { sym: "ITC", name: "ITC", sector: "FMCG" },
  { sym: "HINDUNILVR", name: "Hindustan Unilever", sector: "FMCG" },
  { sym: "NESTLEIND", name: "Nestle India", sector: "FMCG" },
  { sym: "BRITANNIA", name: "Britannia Industries", sector: "FMCG" },
  { sym: "MARUTI", name: "Maruti Suzuki", sector: "Auto" },
  { sym: "TATAMOTORS", name: "Tata Motors", sector: "Auto" },
  { sym: "M&M", name: "Mahindra & Mahindra", sector: "Auto" },
  { sym: "BAJAJ-AUTO", name: "Bajaj Auto", sector: "Auto" },
  { sym: "SUNPHARMA", name: "Sun Pharmaceutical", sector: "Pharma" },
  { sym: "CIPLA", name: "Cipla", sector: "Pharma" },
  { sym: "DRREDDY", name: "Dr Reddy's Labs", sector: "Pharma" },
  { sym: "TATASTEEL", name: "Tata Steel", sector: "Metal" },
  { sym: "JSWSTEEL", name: "JSW Steel", sector: "Metal" },
  { sym: "HINDALCO", name: "Hindalco Industries", sector: "Metal" },
  { sym: "LT", name: "Larsen & Toubro", sector: "Infra" },
  { sym: "BHARTIARTL", name: "Bharti Airtel", sector: "Telecom" },
];

function hashCode(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r2 = (x: number) => Math.round(x * 100) / 100;

// Each symbol gets a deterministic "flavour" so the five scanners each have a
// handful of matches to show. Everything here is synthesized demo data.
type Flavour = "mover" | "gapper" | "volume" | "runner" | "calm";
function flavourOf(sym: string): Flavour {
  return (["mover", "gapper", "volume", "runner", "calm"] as Flavour[])[hashCode(sym + ":flav") % 5];
}

function scanCandles(sym: string, start: number): Candle[] {
  const n = 220;
  const rnd = mulberry32(hashCode(sym + ":scan"));
  const flav = flavourOf(sym);
  const up = rnd() > 0.5;
  const closes: number[] = new Array(n);
  let price = start;
  for (let i = 0; i < n; i++) {
    let drift = (rnd() - 0.5) * 0.004;
    if (flav === "runner") drift += 0.0015; // steady climb → near-high + possible golden cross
    if (flav === "mover" && i >= n - 5) drift += (up ? 1 : -1) * 0.028; // sharp last week
    price *= 1 + drift + (rnd() - 0.5) * 0.02;
    closes[i] = Math.max(1, price);
  }
  return closes.map((close, i) => {
    const wig = close * 0.01;
    const last = i === n - 1;
    let open = close + (rnd() - 0.5) * wig;
    if (last && flav === "gapper") open = closes[i - 1] * (1 + (up ? 1 : -1) * (0.035 + rnd() * 0.03));
    let volume = Math.round(150000 + rnd() * 400000);
    if (last && flav === "volume") volume = Math.round(volume * (3 + rnd() * 2));
    return {
      ts: `D${i + 1}`,
      open: r2(open),
      high: r2(Math.max(open, close) + rnd() * wig),
      low: r2(Math.min(open, close) - rnd() * wig),
      close: r2(close),
      volume,
    };
  });
}

/** Build the scan universe. Deterministic per symbol, so results are stable
 *  across requests within the cache window. */
export function buildUniverse(): ScanInput[] {
  return UNIVERSE.map(({ sym, name, sector }) => {
    const seeded = SAMPLE_STOCKS[sym];
    const start = (seeded ? seeded.price : synthSpot(sym)) * 0.9;
    return { sym, name, sector, candles: scanCandles(sym, start) };
  });
}
