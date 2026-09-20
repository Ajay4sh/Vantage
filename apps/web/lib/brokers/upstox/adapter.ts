// Phase 10.1 — Upstox adapter. The reference implementation the other adapters
// match. It delegates quotes / candles / option-chain to the existing
// lib/upstox/client (unchanged, so nothing that already works breaks) and adds
// getPositions() against Upstox's documented portfolio endpoints.
//
// Note: getPositions needs the full user access token (UPSTOX_ACCESS_TOKEN),
// not the read-only analytics token — portfolio is account-scoped. Like the
// rest of the Upstox integration, the live paths are written to the documented
// API shape but are untested here (no funded account); they stay dormant until
// a token is configured.

import {
  fetchDailyCandles,
  fetchLiveQuotes,
  fetchOptionChain,
  type NormalizedChain,
} from "../../upstox/client";
import { resolveInstrument } from "../../instruments/master";
import type { Candle } from "../../types";
import type {
  BrokerAdapter,
  BrokerCredentials,
  BrokerPosition,
  BrokerQuote,
  BrokerSession,
  OptionType,
  PositionInstrument,
} from "../types";

const API_BASE = "https://api.upstox.com/v2";

function accessToken(): string | null {
  return process.env.UPSTOX_ACCESS_TOKEN || null;
}

async function portfolioGet<T>(path: string): Promise<T> {
  const token = accessToken();
  if (!token) throw new Error("No Upstox access token configured (UPSTOX_ACCESS_TOKEN)");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstox portfolio request failed: ${res.status} (${path})`);
  return res.json() as Promise<T>;
}

// Upstox F&O trading symbols look like "RELIANCE 25 SEP 3000 CE" / "NIFTY ...".
// Best-effort parse of the option leg out of the trading symbol + fields.
function parseOptionLeg(tradingSymbol: string): {
  underlying: string;
  optionType?: OptionType;
  strike?: number;
} {
  const m = tradingSymbol.trim().match(/^(.+?)\s+.*?(\d+(?:\.\d+)?)\s*(CE|PE)$/i);
  if (!m) return { underlying: tradingSymbol.split(/\s+/)[0] ?? tradingSymbol };
  return { underlying: m[1].trim(), strike: Number(m[2]), optionType: m[3].toUpperCase() as OptionType };
}

interface RawPosition {
  trading_symbol?: string;
  tradingsymbol?: string;
  quantity?: number;
  average_price?: number;
  last_price?: number;
  product?: string;
  instrument_type?: string; // "EQ" | "CE" | "PE" | "FUT"
  expiry?: string;
  strike_price?: number;
  option_type?: string;
  multiplier?: number;
}

function mapRaw(r: RawPosition): BrokerPosition {
  const sym = (r.trading_symbol || r.tradingsymbol || "").toString();
  const itype = (r.instrument_type || "").toUpperCase();
  const isOption = itype === "CE" || itype === "PE" || /\b(CE|PE)$/i.test(sym);
  const isFuture = itype === "FUT" || /FUT$/i.test(sym);
  const instrument: PositionInstrument = isOption ? "option" : isFuture ? "future" : "equity";
  const qty = Number(r.quantity ?? 0);

  const leg = isOption ? parseOptionLeg(sym) : { underlying: sym.split(/\s+/)[0] ?? sym };

  return {
    symbol: leg.underlying.toUpperCase(),
    instrument,
    quantity: qty,
    avgPrice: Number(r.average_price ?? 0),
    lastPrice: Number(r.last_price ?? 0),
    product: r.product,
    ...(isOption
      ? {
          optionType: (r.option_type?.toUpperCase() as OptionType) || leg.optionType,
          side: qty >= 0 ? ("long" as const) : ("short" as const),
          strike: r.strike_price ?? leg.strike,
          expiry: r.expiry,
          lotSize: r.multiplier && qty !== 0 ? Math.abs(r.multiplier) : undefined,
        }
      : {}),
  };
}

export const upstoxAdapter: BrokerAdapter = {
  id: "upstox",
  label: "Upstox",

  configured() {
    return !!(process.env.UPSTOX_ACCESS_TOKEN || process.env.UPSTOX_ANALYTICS_TOKEN);
  },

  async authenticate(_credentials: BrokerCredentials): Promise<BrokerSession> {
    // Upstox uses a daily OAuth token refreshed out-of-band (npm run
    // refresh-token). The env token is the session; we surface it as one.
    const token = accessToken();
    if (!token) throw new Error("Upstox not authenticated — set UPSTOX_ACCESS_TOKEN");
    return { brokerId: "upstox", accessToken: token };
  },

  async getQuote(symbol: string): Promise<BrokerQuote> {
    const entry = await resolveInstrument(symbol);
    if (!entry) throw new Error(`Unknown instrument: ${symbol}`);
    const res = await fetchLiveQuotes({ [symbol.toUpperCase()]: entry.key });
    const q = res.quotes[symbol.toUpperCase()];
    if (!q) throw new Error(`No quote returned for ${symbol}`);
    return { symbol: symbol.toUpperCase(), last: q.price, netChange: q.chg, changePct: q.chgPct };
  },

  async getHistoricalCandles(symbol: string, _interval: string, range: string): Promise<Candle[]> {
    const entry = await resolveInstrument(symbol);
    if (!entry) throw new Error(`Unknown instrument: ${symbol}`);
    const days = Number.parseInt(range, 10);
    return fetchDailyCandles(entry.key, Number.isFinite(days) && days > 0 ? days : 220);
  },

  async getPositions(_session?: BrokerSession): Promise<BrokerPosition[]> {
    // Merge intraday/F&O positions with long-term holdings.
    const [posBody, holdBody] = await Promise.all([
      portfolioGet<{ data?: RawPosition[] }>("/portfolio/short-term-positions").catch(() => ({ data: [] })),
      portfolioGet<{ data?: RawPosition[] }>("/portfolio/long-term-holdings").catch(() => ({ data: [] })),
    ]);
    const positions = (posBody.data ?? []).map(mapRaw);
    const holdings = (holdBody.data ?? []).map(mapRaw);
    return [...positions, ...holdings].filter((p) => p.quantity !== 0);
  },

  async getOptionChain(symbol: string, expiry: string): Promise<NormalizedChain> {
    const entry = await resolveInstrument(symbol);
    if (!entry) throw new Error(`Unknown instrument: ${symbol}`);
    const exp = expiry === "current_week" ? "current_week" : "current_month";
    return fetchOptionChain(entry.key, exp);
  },
};
