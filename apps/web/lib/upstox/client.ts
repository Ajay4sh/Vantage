// Upstox API client. Phase 1: market quotes. Phase 2: historical candles
// (v3) + company fundamentals. Later phases add option chain and news on the
// same auth flow.
//
// Parsing is deliberately paranoid: if a response shape changes upstream we
// throw loudly rather than serving wrong/stale-looking numbers (build
// instructions §7). Parsers are exported for unit tests.
//
// Endpoint references (docs verified 2026-07-10):
//   quotes:       GET /v2/market-quote/quotes?instrument_key=...
//   candles v3:   GET /v3/historical-candle/{instrument_key}/{unit}/{interval}/{to}/{from}
//   key ratios:   GET /v2/fundamentals/{isin}/key-ratios
//   income stmt:  GET /v2/fundamentals/{isin}/income-statement?fs=true

import { EQUITY_INSTRUMENTS, INDEX_INSTRUMENTS, indexNameForInstrument, symbolForInstrument } from "./instruments";
import { marketDataToken } from "./token";
import type { Candle, Fundamentals, IndexQuote, QuotesResponse, QuoteUpdate } from "../types";

const API_BASE = "https://api.upstox.com/v2";
const API_BASE_V3 = "https://api.upstox.com/v3";

async function authedGet<T>(url: string): Promise<T> {
  const token = marketDataToken();
  if (!token) throw new Error("No Upstox token configured");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstox request failed: ${res.status} ${await res.text()} (${url})`);
  }
  return res.json() as Promise<T>;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const n = parseFloat(v.replace(/[%,₹\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// ===== Market quotes (Phase 1) =====

interface UpstoxQuoteEntry {
  instrument_token?: string;
  last_price?: number;
  net_change?: number;
}

function pctFromNetChange(lastPrice: number, netChange: number): number {
  const prevClose = lastPrice - netChange;
  return prevClose !== 0 ? (netChange / prevClose) * 100 : 0;
}

/** Live quotes for the given symbol→instrument-key map (defaults to the
 *  seeded demo universe) plus the headline indices. */
export async function fetchLiveQuotes(equityKeys?: Record<string, string>): Promise<QuotesResponse> {
  const eq = equityKeys && Object.keys(equityKeys).length > 0 ? equityKeys : EQUITY_INSTRUMENTS;
  const keyToSym = new Map(Object.entries(eq).map(([sym, key]) => [key, sym]));
  const keys = [...keyToSym.keys(), ...Object.values(INDEX_INSTRUMENTS)];
  const body = await authedGet<{ status?: string; data?: Record<string, UpstoxQuoteEntry> }>(
    `${API_BASE}/market-quote/quotes?instrument_key=${encodeURIComponent(keys.join(","))}`,
  );
  if (body.status !== "success" || typeof body.data !== "object" || body.data === null) {
    throw new Error("Upstox market-quote response shape changed — refusing to parse it silently");
  }

  const quotes: Record<string, QuoteUpdate> = {};
  const indices: IndexQuote[] = [];

  for (const entry of Object.values(body.data)) {
    if (typeof entry.instrument_token !== "string" || typeof entry.last_price !== "number") {
      throw new Error("Upstox quote entry missing instrument_token/last_price — response shape changed");
    }
    const netChange = typeof entry.net_change === "number" ? entry.net_change : 0;

    const sym = keyToSym.get(entry.instrument_token) ?? symbolForInstrument(entry.instrument_token);
    if (sym) {
      quotes[sym] = {
        price: entry.last_price,
        chg: netChange,
        chgPct: pctFromNetChange(entry.last_price, netChange),
      };
      continue;
    }

    const indexName = indexNameForInstrument(entry.instrument_token);
    if (indexName) {
      indices.push({
        name: indexName,
        prefix: "",
        decimals: 0,
        value: entry.last_price,
        changePct: pctFromNetChange(entry.last_price, netChange),
      });
    }
  }

  if (Object.keys(quotes).length === 0) {
    throw new Error("Upstox returned no recognizable equity quotes — check instrument keys");
  }

  return { source: "live", asOf: new Date().toISOString(), indices, quotes };
}

// ===== Historical candles (Phase 2) =====

/** Upstox returns candles newest-first as positional arrays
 *  [ts, open, high, low, close, volume, oi]; we validate and flip to
 *  oldest-first, which is what every indicator expects. */
export function parseCandleResponse(body: unknown): Candle[] {
  const b = body as { status?: string; data?: { candles?: unknown } };
  if (b.status !== "success" || !b.data || !Array.isArray(b.data.candles)) {
    throw new Error("Upstox candle response shape changed — refusing to parse it silently");
  }
  const parsed = b.data.candles.map((row): Candle => {
    if (!Array.isArray(row) || row.length < 6) {
      throw new Error("Upstox candle row shape changed — expected [ts, o, h, l, c, vol, ...]");
    }
    const [ts, open, high, low, close, volume] = row;
    if ([open, high, low, close].some((v) => typeof v !== "number" || !Number.isFinite(v))) {
      throw new Error("Upstox candle row contains non-numeric OHLC — response shape changed");
    }
    return { ts: String(ts), open, high, low, close, volume: Number(volume) || 0 };
  });
  if (parsed.length === 0) throw new Error("Upstox returned zero candles");
  return parsed.reverse();
}

/** Daily candles for an instrument key, oldest-first. ~220 calendar days back
 *  gives 150ish trading sessions — enough for the 50-day averages with margin. */
export async function fetchDailyCandles(instrumentKey: string, calendarDays = 220): Promise<Candle[]> {
  const key = instrumentKey;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const to = new Date();
  const from = new Date(Date.now() - calendarDays * 86400000);
  const body = await authedGet(
    `${API_BASE_V3}/historical-candle/${encodeURIComponent(key)}/days/1/${fmt(to)}/${fmt(from)}`,
  );
  return parseCandleResponse(body);
}

// ===== Option chain (Phase 3) =====

export interface NormalizedChain {
  expiry: string; // ISO date
  spot: number;
  strikes: number[];
  callOI: number[];
  putOI: number[];
  callIV: number[];
  putIV: number[];
}

interface ChainLeg {
  market_data?: { oi?: unknown };
  option_greeks?: { iv?: unknown };
}

interface ChainRow {
  expiry?: unknown;
  strike_price?: unknown;
  underlying_spot_price?: unknown;
  call_options?: ChainLeg;
  put_options?: ChainLeg;
}

/** Normalize the /v2/option/chain response: sorted strikes, aligned OI and
 *  per-strike IV arrays, trimmed to a window around ATM so a 40-strike chain
 *  doesn't drown the UI. Throws loudly on shape drift. */
export function parseOptionChain(body: unknown, maxStrikes = 13): NormalizedChain {
  const b = body as { status?: string; data?: unknown };
  if (b.status !== "success" || !Array.isArray(b.data) || b.data.length === 0) {
    throw new Error("Upstox option-chain response shape changed — refusing to parse it silently");
  }

  const rows = (b.data as ChainRow[])
    .filter((r) => typeof r.strike_price === "number")
    .sort((a, b2) => (a.strike_price as number) - (b2.strike_price as number));
  if (rows.length < 4) {
    throw new Error(`Upstox option-chain returned only ${rows.length} strikes — expected a full chain`);
  }

  const spot = rows.find((r) => typeof r.underlying_spot_price === "number")?.underlying_spot_price as
    | number
    | undefined;
  const expiry = rows.find((r) => typeof r.expiry === "string")?.expiry as string | undefined;
  if (spot === undefined || expiry === undefined) {
    throw new Error("Upstox option-chain missing underlying_spot_price/expiry — response shape changed");
  }

  // Trim to maxStrikes centered on ATM.
  let atmIdx = 0;
  for (let i = 1; i < rows.length; i++) {
    if (Math.abs((rows[i].strike_price as number) - spot) < Math.abs((rows[atmIdx].strike_price as number) - spot)) {
      atmIdx = i;
    }
  }
  const half = Math.floor(maxStrikes / 2);
  const start = Math.max(0, Math.min(atmIdx - half, rows.length - maxStrikes));
  const window = rows.slice(start, start + maxStrikes);

  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

  return {
    expiry,
    spot,
    strikes: window.map((r) => r.strike_price as number),
    callOI: window.map((r) => num(r.call_options?.market_data?.oi)),
    putOI: window.map((r) => num(r.put_options?.market_data?.oi)),
    callIV: window.map((r) => num(r.call_options?.option_greeks?.iv)),
    putIV: window.map((r) => num(r.put_options?.option_greeks?.iv)),
  };
}

/** Front-expiry option chain for an instrument key. Stock F&O in India is on
 *  a monthly cycle; index options (Nifty, Bank Nifty) are weekly. */
export async function fetchOptionChain(
  instrumentKey: string,
  expiry: "current_month" | "current_week" = "current_month",
): Promise<NormalizedChain> {
  const body = await authedGet(
    `${API_BASE}/option/chain?instrument_key=${encodeURIComponent(instrumentKey)}&expiry_date=${expiry}`,
  );
  return parseOptionChain(body);
}

// ===== Fundamentals (Phase 2) =====

export interface KeyRatioValue {
  company: number | null;
  sector: number | null;
}

/** key-ratios returns [{name, company_value, sector_value}] with names like
 *  "P/E" / "ROE"; match on substrings so cosmetic renames don't break us,
 *  but throw if nothing recognizable comes back. */
export function parseKeyRatios(body: unknown): Record<string, KeyRatioValue> {
  const b = body as { status?: string; data?: unknown };
  if (b.status !== "success" || !Array.isArray(b.data)) {
    throw new Error("Upstox key-ratios response shape changed — refusing to parse it silently");
  }
  const out: Record<string, KeyRatioValue> = {};
  for (const raw of b.data) {
    const e = raw as { name?: unknown; company_value?: unknown; sector_value?: unknown };
    if (typeof e.name !== "string") continue;
    const name = e.name.toLowerCase();
    const key = name.includes("p/e")
      ? "pe"
      : name.includes("p/b")
        ? "pb"
        : name.includes("roce")
          ? "roce"
          : name.includes("roe")
            ? "roe"
            : name.includes("roa")
              ? "roa"
              : name.includes("ebitda")
                ? "evEbitda"
                : null;
    if (!key) continue;
    out[key] = { company: toNum(e.company_value), sector: toNum(e.sector_value) };
  }
  if (Object.keys(out).length === 0) {
    throw new Error("Upstox key-ratios returned no recognizable ratios — response shape changed");
  }
  return out;
}

export interface IncomeSummary {
  revGrowth: number | null;
  opMargin: number | null;
  netMargin: number | null;
  eps: number | null;
}

interface HistoryPoint {
  value?: unknown;
  period?: unknown;
  change?: unknown;
}

function periodTime(p: unknown): number {
  const t = Date.parse(String(p ?? ""));
  return Number.isFinite(t) ? t : 0;
}

function latestPoint(history: unknown): { value: number | null; change: number | null; prev: number | null } {
  if (!Array.isArray(history) || history.length === 0) return { value: null, change: null, prev: null };
  const sorted = [...history].sort(
    (a, b) => periodTime((b as HistoryPoint).period) - periodTime((a as HistoryPoint).period),
  ) as HistoryPoint[];
  return {
    value: toNum(sorted[0]?.value),
    change: toNum(sorted[0]?.change),
    prev: toNum(sorted[1]?.value),
  };
}

/** Condense the income statement into the ratios the terminal displays.
 *  Values arrive in ₹ crore; margins are unit-agnostic so that's fine. */
export function parseIncomeStatement(body: unknown): IncomeSummary {
  const b = body as {
    status?: string;
    data?: { income_statement?: unknown; full_statement?: unknown };
  };
  if (b.status !== "success" || !b.data || !Array.isArray(b.data.income_statement)) {
    throw new Error("Upstox income-statement response shape changed — refusing to parse it silently");
  }
  const rows = b.data.income_statement as { category?: unknown; history?: unknown }[];
  const byCategory = (cat: string) => rows.find((r) => r.category === cat)?.history;

  const rev = latestPoint(byCategory("revenue"));
  const op = latestPoint(byCategory("operating_profit"));
  const net = latestPoint(byCategory("net_profit"));
  if (rev.value === null) {
    throw new Error("Upstox income-statement missing revenue history — response shape changed");
  }

  let revGrowth = rev.change;
  if (revGrowth === null && rev.prev !== null && rev.prev !== 0) {
    revGrowth = Math.round(((rev.value - rev.prev) / Math.abs(rev.prev)) * 1000) / 10;
  }

  const margin = (num: number | null) =>
    num !== null && rev.value !== null && rev.value !== 0 ? Math.round((num / rev.value) * 1000) / 10 : null;

  let eps: number | null = null;
  if (Array.isArray(b.data.full_statement)) {
    const epsRow = (b.data.full_statement as { particular?: unknown; history?: unknown }[]).find(
      (r) => typeof r.particular === "string" && r.particular.toLowerCase().includes("eps"),
    );
    if (epsRow) eps = latestPoint(epsRow.history).value;
  }

  return { revGrowth, opMargin: margin(op.value), netMargin: margin(net.value), eps };
}

/** Full fundamentals block for an ISIN from key-ratios + income statement.
 *  D/E and dividend yield have no live source in this endpoint family — they
 *  stay null (rendered as "—") until a screener.in/Tijori fallback exists. */
export async function fetchFundamentals(isin: string): Promise<Fundamentals> {
  const [ratiosBody, incomeBody] = await Promise.all([
    authedGet(`${API_BASE}/fundamentals/${isin}/key-ratios`),
    authedGet(`${API_BASE}/fundamentals/${isin}/income-statement?fs=true`),
  ]);
  const ratios = parseKeyRatios(ratiosBody);
  const income = parseIncomeStatement(incomeBody);

  const pe = ratios.pe?.company ?? null;
  const peSector = ratios.pe?.sector ?? null;
  const valuationNote =
    pe !== null && peSector !== null
      ? `P/E ${pe} vs sector average ${peSector} — trading at a ${pe > peSector ? "premium" : "discount"} to peers (Upstox Fundamentals API).`
      : "Ratios from Upstox Fundamentals API; sector comparison unavailable for this stock.";

  return {
    pe,
    roe: ratios.roe?.company ?? null,
    de: null,
    eps: income.eps,
    revGrowth: income.revGrowth,
    divYield: null,
    opMargin: income.opMargin,
    netMargin: income.netMargin,
    valuationNote,
    capex: "", // narrative capital-allocation commentary has no live source; card hides when empty
  };
}
