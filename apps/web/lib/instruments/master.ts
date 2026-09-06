// Instrument master: the full NSE directory (every listed equity + index),
// ingested from Upstox's public instrument dump. This file is what turns the
// terminal from a fixed 6-stock demo into full-market search.
//
// The dump at assets.upstox.com is public — no API credentials required — so
// search works even before Upstox auth exists. It refreshes daily upstream;
// we cache the parsed directory in-process for 24h. If the download fails
// (offline), we fall back to the seeded demo universe so nothing breaks.
//
// Note: NSE.json.gz includes every F&O contract too (tens of thousands of
// rows). We JSON.parse the whole thing and keep only equities + indices —
// a one-off ~100MB parse spike per day per instance, fine for a personal
// terminal; revisit with a streaming parser if this ever runs on tiny lambdas.

import { gunzipSync } from "node:zlib";
import { SAMPLE_STOCKS } from "../sample-data";
import { EQUITY_INSTRUMENTS } from "../upstox/instruments";

const MASTER_URL = "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz";
const TTL_MS = 24 * 3600 * 1000;

export type InstrumentKind = "equity" | "index";

export interface DirEntry {
  sym: string;
  name: string;
  key: string; // Upstox instrument_key
  isin: string | null;
  kind: InstrumentKind;
  lotSize: number | null;
}

interface RawInstrument {
  segment?: unknown;
  instrument_type?: unknown;
  instrument_key?: unknown;
  trading_symbol?: unknown;
  name?: unknown;
  isin?: unknown;
  lot_size?: unknown;
}

/** Filter the raw dump down to NSE equities + indices. Exported for tests. */
export function buildDirectory(raw: unknown[]): DirEntry[] {
  const out: DirEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const r = item as RawInstrument;
    if (typeof r.instrument_key !== "string") continue;

    let kind: InstrumentKind;
    if (r.segment === "NSE_EQ" && r.instrument_type === "EQ") kind = "equity";
    else if (r.segment === "NSE_INDEX") kind = "index";
    else continue;

    const name = typeof r.name === "string" && r.name ? r.name : String(r.trading_symbol ?? "");
    const sym =
      typeof r.trading_symbol === "string" && r.trading_symbol ? r.trading_symbol.toUpperCase() : name.toUpperCase();
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);

    out.push({
      sym,
      name,
      key: r.instrument_key,
      isin: typeof r.isin === "string" ? r.isin : null,
      kind,
      lotSize: typeof r.lot_size === "number" && r.lot_size > 0 ? r.lot_size : null,
    });
  }
  if (out.length === 0) throw new Error("Instrument master parse produced zero entries — dump format changed");
  return out;
}

/** Seeded demo universe + headline indices; the offline fallback and the
 *  fast path for the six demo names. */
export function fallbackDirectory(): DirEntry[] {
  const equities: DirEntry[] = Object.entries(EQUITY_INSTRUMENTS).map(([sym, key]) => ({
    sym,
    name: SAMPLE_STOCKS[sym]?.name ?? sym,
    key,
    isin: key.split("|")[1] ?? null,
    kind: "equity",
    lotSize: SAMPLE_STOCKS[sym]?.options.lotSize ?? null,
  }));
  const indices: DirEntry[] = [
    { sym: "NIFTY 50", name: "Nifty 50", key: "NSE_INDEX|Nifty 50", isin: null, kind: "index", lotSize: null },
    { sym: "BANK NIFTY", name: "Nifty Bank", key: "NSE_INDEX|Nifty Bank", isin: null, kind: "index", lotSize: null },
    { sym: "NIFTY IT", name: "Nifty IT", key: "NSE_INDEX|Nifty IT", isin: null, kind: "index", lotSize: null },
    { sym: "SENSEX", name: "BSE Sensex", key: "BSE_INDEX|SENSEX", isin: null, kind: "index", lotSize: null },
  ];
  return [...equities, ...indices];
}

interface DirCache {
  entries: DirEntry[];
  bySym: Map<string, DirEntry>;
  fetchedAt: number;
  complete: boolean; // false when running on the fallback
}

const g = globalThis as unknown as { __vantageDir?: DirCache };

function indexDir(entries: DirEntry[], complete: boolean): DirCache {
  const bySym = new Map<string, DirEntry>();
  for (const e of entries) bySym.set(e.sym, e);
  // SENSEX lives on BSE and isn't in the NSE dump — always keep it findable.
  for (const fb of fallbackDirectory()) if (!bySym.has(fb.sym)) bySym.set(fb.sym, fb);
  return { entries: Array.from(bySym.values()), bySym, fetchedAt: Date.now(), complete };
}

async function loadDirectory(): Promise<DirCache> {
  const cur = g.__vantageDir;
  if (cur && (cur.complete ? Date.now() - cur.fetchedAt < TTL_MS : Date.now() - cur.fetchedAt < 5 * 60 * 1000)) {
    return cur;
  }
  try {
    const res = await fetch(MASTER_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`instrument master download failed: ${res.status}`);
    const gz = Buffer.from(await res.arrayBuffer());
    const raw = JSON.parse(gunzipSync(gz).toString("utf8"));
    if (!Array.isArray(raw)) throw new Error("instrument master is not an array — dump format changed");
    g.__vantageDir = indexDir(buildDirectory(raw), true);
    console.log(`instrument master loaded: ${g.__vantageDir.entries.length} NSE instruments`);
  } catch (err) {
    console.error("instrument master unavailable, using seeded fallback:", err);
    // Keep an existing complete directory if we have one; otherwise fallback.
    if (!g.__vantageDir?.complete) g.__vantageDir = indexDir(fallbackDirectory(), false);
    else g.__vantageDir.fetchedAt = Date.now(); // retry later, serve stale now
  }
  return g.__vantageDir!;
}

/** Rank: symbol prefix < name prefix < symbol substring < name substring.
 *  Exported for tests. */
export function searchDirectory(entries: DirEntry[], q: string, limit = 20): DirEntry[] {
  const needle = q.trim().toUpperCase();
  if (!needle) return [];
  const scored: { e: DirEntry; score: number }[] = [];
  for (const e of entries) {
    const nameUp = e.name.toUpperCase();
    let score: number | null = null;
    if (e.sym.startsWith(needle)) score = 0;
    else if (nameUp.startsWith(needle)) score = 1;
    else if (e.sym.includes(needle)) score = 2;
    else if (nameUp.includes(needle)) score = 3;
    if (score !== null) scored.push({ e, score });
  }
  scored.sort((a, b) => a.score - b.score || a.e.sym.length - b.e.sym.length || a.e.sym.localeCompare(b.e.sym));
  return scored.slice(0, limit).map((s) => s.e);
}

export async function searchInstruments(q: string, limit = 20): Promise<DirEntry[]> {
  const dir = await loadDirectory();
  return searchDirectory(dir.entries, q, limit);
}

/** Resolve a symbol to its directory entry. Seeded names resolve without any
 *  network; everything else needs the master (downloads on first use). */
export async function resolveInstrument(sym: string): Promise<DirEntry | null> {
  const upper = sym.toUpperCase();
  const seeded = fallbackDirectory().find((e) => e.sym === upper);
  if (seeded) return seeded;
  const dir = await loadDirectory();
  return dir.bySym.get(upper) ?? null;
}

export async function directoryStatus(): Promise<{ complete: boolean; count: number }> {
  const dir = await loadDirectory();
  return { complete: dir.complete, count: dir.entries.length };
}
