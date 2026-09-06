// Deterministic placeholder data for instruments outside the seeded demo six.
// Until Upstox credentials exist, selecting any searched stock/index gets a
// synthesized — clearly badged — dataset: a seeded random walk for price
// history, a plausible option chain, and *no fabricated narratives* (no fake
// news headlines, no made-up fundamentals). Every derived number (RSI, max
// pain, greeks) is computed by the same real engines used in live mode.
//
// Determinism matters: the same symbol always synthesizes the same base data,
// so the UI is stable across requests and the server sim can tick it.

import { buildTechnicals } from "./technicals";
import type { InstrumentKind } from "./instruments/master";
import type { Candle, OptionsData, Stock } from "./types";

function hashCode(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — tiny, fast, deterministic. */
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

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Log-uniform base price ₹60–₹4000 — the range most NSE names live in. */
export function synthSpot(sym: string): number {
  const rnd = mulberry32(hashCode(sym + ":spot"))();
  return round2(60 * Math.exp(rnd * Math.log(4000 / 60)));
}

/** Backward random walk ending exactly at `spot`, ~1.5% daily vol with a
 *  gentle deterministic drift. */
export function synthCandles(sym: string, spot: number, n = 120): Candle[] {
  const rnd = mulberry32(hashCode(sym + ":candles"));
  const drift = (rnd() - 0.5) * 0.002;
  const closes: number[] = new Array(n);
  closes[n - 1] = spot;
  for (let i = n - 2; i >= 0; i--) {
    closes[i] = closes[i + 1] / (1 + drift + (rnd() - 0.5) * 0.03);
  }
  return closes.map((close, i) => {
    const wiggle = close * 0.008;
    return {
      ts: `D${i + 1}`,
      open: round2(close + (rnd() - 0.5) * wiggle),
      high: round2(close + rnd() * wiggle),
      low: round2(close - rnd() * wiggle),
      close: round2(close),
      volume: Math.round(50000 + rnd() * 500000),
    };
  });
}

function niceStrikeStep(spot: number): number {
  const raw = spot * 0.025;
  const steps = [0.5, 1, 2.5, 5, 10, 20, 25, 50, 100, 250, 500];
  return steps.find((s) => s >= raw) ?? 1000;
}

/** Seven-strike chain centered near spot: OI peaks around ATM, flat-ish IV
 *  seeded per symbol. Per-strike smile gets applied downstream by the
 *  analytics engine's synthesizeSmile, same as the demo stocks. */
export function synthChain(sym: string, spot: number): Pick<OptionsData, "strikes" | "callOI" | "putOI" | "iv"> {
  const rnd = mulberry32(hashCode(sym + ":chain"));
  const step = niceStrikeStep(spot);
  const atm = Math.round(spot / step) * step;
  const strikes = [-3, -2, -1, 0, 1, 2, 3].map((k) => round2(atm + k * step));
  const shape = [0.35, 0.6, 0.85, 1, 0.8, 0.55, 0.3];
  const base = 4000 + rnd() * 20000;
  const putTilt = 0.8 + rnd() * 0.5; // per-symbol PCR personality
  const callOI = shape.map((s) => Math.round(base * s * (0.85 + rnd() * 0.3)));
  const putOI = shape.map((s) => Math.round(base * s * putTilt * (0.85 + rnd() * 0.3)));
  return { strikes, callOI, putOI, iv: round2(18 + rnd() * 22) };
}

function nextMonthlyExpiry(): { iso: string; display: string } {
  // Last Tuesday of the current month (NSE stock F&O cycle), or next month's
  // if that has passed.
  const now = new Date();
  const lastTuesday = (y: number, m: number) => {
    const d = new Date(y, m + 1, 0); // last day of month
    d.setDate(d.getDate() - ((d.getDay() + 5) % 7)); // back to Tuesday
    return d;
  };
  let exp = lastTuesday(now.getFullYear(), now.getMonth());
  if (exp.getTime() < now.getTime()) exp = lastTuesday(now.getFullYear(), now.getMonth() + 1);
  const iso = `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, "0")}-${String(exp.getDate()).padStart(2, "0")}`;
  const display = exp.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
  return { iso, display };
}

const PLACEHOLDER_NOTE =
  "Synthesized placeholder — no real data for this instrument yet. Connect Upstox credentials for live figures.";

/** Full Stock shell for an un-seeded instrument. Real math over synthetic
 *  prices; nulls and empty lists where honesty demands it. */
export function synthStock(input: {
  sym: string;
  name: string;
  kind: InstrumentKind;
  lotSize?: number | null;
  /** Realistic base level when one is known (e.g. headline indices). */
  spot?: number;
}): Stock {
  const spot = input.spot ?? synthSpot(input.sym);
  const candles = synthCandles(input.sym, spot);
  const closes = candles.map((c) => c.close);
  const technicals = buildTechnicals(candles);
  technicals.note = `${technicals.note} ${PLACEHOLDER_NOTE}`;
  const chain = synthChain(input.sym, spot);
  const expiry = nextMonthlyExpiry();
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);

  return {
    sym: input.sym,
    name: input.name,
    sector: input.kind === "index" ? "Index" : "NSE",
    kind: input.kind,
    price: spot,
    chg: 0,
    chgPct: 0,
    marketCap: "—",
    pe: null,
    week52: `${round2(lo)} – ${round2(hi)}`,
    spark: closes.slice(-10),
    fundamentals: {
      pe: null,
      roe: null,
      de: null,
      eps: null,
      revGrowth: null,
      divYield: null,
      opMargin: null,
      netMargin: null,
      valuationNote:
        input.kind === "index" ? "Fundamental ratios don't apply to an index." : PLACEHOLDER_NOTE,
      capex: "",
    },
    technicals,
    options: {
      expiry: expiry.display,
      expiryDate: expiry.iso,
      lotSize: input.lotSize ?? 0,
      pcr: round2(chain.putOI.reduce((a, b) => a + b, 0) / chain.callOI.reduce((a, b) => a + b, 0)),
      maxPain: chain.strikes[3],
      iv: chain.iv,
      ivRank: PLACEHOLDER_NOTE,
      strikes: chain.strikes,
      callOI: chain.callOI,
      putOI: chain.putOI,
    },
    news: [], // never fabricate headlines
  };
}
