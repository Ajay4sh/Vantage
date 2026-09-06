// Server-side port of the demo's tickStocks()/tickIndices() random walk.
// It backs /api/quotes whenever no Upstox token is configured, so the terminal
// stays fully demo-able. The client shows the "SIMULATED LIVE" badge whenever
// this is the source — it is NOT real market data, and the whole module goes
// away once real quotes are the only path.
//
// Dynamic universe: any symbol can be requested. Seeded demo names start from
// their sample prices; everything else lazily seeds from the deterministic
// synthesizer, so a searched stock ticks just like the demo six.

import { SAMPLE_INDICES, SAMPLE_STOCKS } from "./sample-data";
import { synthChain, synthSpot } from "./synth";
import type { QuotesResponse, QuoteUpdate } from "./types";

interface SimStockState {
  openPrice: number;
  price: number;
  callOI: number[];
  putOI: number[];
}

interface SimState {
  indices: Record<string, { cur: number }>;
  stocks: Record<string, SimStockState>;
}

// Survives hot-reload in dev; per-instance in serverless is fine for a demo feed.
const g = globalThis as unknown as { __vantageSim?: SimState };

function initState(): SimState {
  const state: SimState = { indices: {}, stocks: {} };
  for (const i of SAMPLE_INDICES) state.indices[i.name] = { cur: i.base };
  return state;
}

function ensureStock(state: SimState, sym: string): SimStockState {
  let st = state.stocks[sym];
  if (!st) {
    const seeded = SAMPLE_STOCKS[sym];
    // Headline indices tick around their known real levels (same seeding as
    // the /api/stocks shell), everything else from the deterministic synth.
    const indexSeed = SAMPLE_INDICES.find((i) => i.name === sym)?.base;
    const price = seeded?.price ?? indexSeed ?? synthSpot(sym);
    const chain = seeded ? seeded.options : synthChain(sym, price);
    st = { openPrice: price, price, callOI: [...chain.callOI], putOI: [...chain.putOI] };
    state.stocks[sym] = st;
  }
  return st;
}

/** Advance the random walk one tick for the requested symbols and return a
 *  quotes payload. Each /api/quotes poll drives one tick, mirroring the
 *  demo's TICK_MS loop. */
export function simulatedSnapshot(symbols?: string[]): QuotesResponse {
  const state = (g.__vantageSim ??= initState());
  const syms = symbols && symbols.length > 0 ? symbols : Object.keys(SAMPLE_STOCKS);

  const indices = SAMPLE_INDICES.map((i) => {
    const st = state.indices[i.name];
    const meanReversion = (i.base - st.cur) * 0.03; // gentle pull back to the seed value
    const noise = st.cur * i.vol * (Math.random() - 0.5) * 2;
    st.cur = st.cur + meanReversion + noise;
    return {
      name: i.name,
      prefix: i.prefix,
      decimals: i.decimals,
      value: st.cur,
      changePct: ((st.cur - i.base) / i.base) * 100,
    };
  });

  const quotes: Record<string, QuoteUpdate> = {};
  for (const sym of syms) {
    const st = ensureStock(state, sym);

    const vol = 0.0018; // ~0.18% per tick, roughly comparable to real intraday noise
    const meanReversion = (st.openPrice - st.price) * 0.015;
    let next = st.price + st.price * vol * (Math.random() - 0.5) * 2 + meanReversion;
    next = Math.round(next * 100) / 100;
    st.price = next;

    // Nudge options OI slightly and recompute PCR from the live numbers
    st.callOI = st.callOI.map((v) => Math.max(500, Math.round(v * (1 + (Math.random() - 0.5) * 0.03))));
    st.putOI = st.putOI.map((v) => Math.max(500, Math.round(v * (1 + (Math.random() - 0.5) * 0.03))));
    const totalCall = st.callOI.reduce((a, b) => a + b, 0);
    const totalPut = st.putOI.reduce((a, b) => a + b, 0);
    const pcr = Math.round((totalPut / totalCall) * 100) / 100;

    quotes[sym] = {
      price: st.price,
      chg: Math.round((st.price - st.openPrice) * 100) / 100,
      chgPct: ((st.price - st.openPrice) / st.openPrice) * 100,
      options: { callOI: [...st.callOI], putOI: [...st.putOI], pcr },
    };
  }

  return { source: "simulated", asOf: new Date().toISOString(), indices, quotes };
}
