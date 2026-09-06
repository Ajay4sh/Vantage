// Phase 3 options endpoint, dynamic-universe edition. PCR, max pain, OI
// walls, greeks, IV-vs-realized premium, skew, and discrete signals computed
// server-side (lib/options.ts) for any directory symbol — stocks on the
// monthly F&O cycle, indices (Nifty, Bank Nifty) on weeklies.
//
//   GET /api/options?symbol=BPCL              → full analytics for one symbol
//   GET /api/options?radar=1&symbols=A,B,C    → ranked positioning summary
//
// Live mode uses the real chain (per-strike IV); sample mode synthesizes a
// smile around the flat IV. 60s cache TTL live.

import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { buildOptionsAnalytics, dteFromIso, synthesizeSmile } from "@/lib/options";
import { SAMPLE_STOCKS } from "@/lib/sample-data";
import { parseSymbolsParam, stockFor, type ResolvedStock } from "@/lib/stock-source";
import { fetchDailyCandles, fetchOptionChain } from "@/lib/upstox/client";
import { marketDataToken } from "@/lib/upstox/token";
import type { OptionsAnalytics, OptionsData, RadarEntry, Stock } from "@/lib/types";

export const dynamic = "force-dynamic";

function sampleAnalytics(stock: Stock): OptionsAnalytics {
  const o = stock.options;
  const { callIV, putIV } = synthesizeSmile(o.iv, o.strikes, stock.price);
  return buildOptionsAnalytics({
    source: "sample",
    spot: stock.price,
    expiry: o.expiry,
    dte: dteFromIso(o.expiryDate),
    strikes: o.strikes,
    callOI: o.callOI,
    putOI: o.putOI,
    callIV,
    putIV,
    closes: stock.technicals.priceHistory,
  });
}

async function liveAnalytics(resolved: ResolvedStock): Promise<{ analytics: OptionsAnalytics; options: OptionsData }> {
  const { entry, stock } = resolved;
  return cached(`options:v2:${entry.sym}`, 60, async () => {
    const [chain, candles] = await Promise.all([
      fetchOptionChain(entry.key, entry.kind === "index" ? "current_week" : "current_month"),
      cached(`candles:v2:${entry.sym}`, 3600, () => fetchDailyCandles(entry.key)),
    ]);
    const analytics = buildOptionsAnalytics({
      source: "live",
      spot: chain.spot,
      expiry: chain.expiry,
      dte: dteFromIso(chain.expiry),
      strikes: chain.strikes,
      callOI: chain.callOI,
      putOI: chain.putOI,
      callIV: chain.callIV,
      putIV: chain.putIV,
      closes: candles.map((c) => c.close),
    });
    // Updated OptionsData block so the existing UI (OI chart, implied move,
    // header cards) runs off the real chain once merged client-side.
    const options: OptionsData = {
      ...stock.options,
      expiry: chain.expiry,
      expiryDate: chain.expiry,
      pcr: analytics.pcr,
      maxPain: analytics.maxPain,
      iv: analytics.ivAtm,
      ivRank:
        analytics.rv20 !== null
          ? `ATM IV ${analytics.ivAtm}% vs 20-day realized ${analytics.rv20}% — premium ${
              analytics.ivPremiumPct !== null && analytics.ivPremiumPct >= 25
                ? "rich"
                : analytics.ivPremiumPct !== null && analytics.ivPremiumPct <= -10
                  ? "cheap"
                  : "fair"
            } vs recent movement`
          : stock.options.ivRank,
      strikes: chain.strikes,
      callOI: chain.callOI,
      putOI: chain.putOI,
    };
    return { analytics, options };
  });
}

async function analyticsFor(symbol: string): Promise<{
  source: "sample" | "live";
  analytics: OptionsAnalytics;
  options: OptionsData;
} | null> {
  const resolved = await stockFor(symbol);
  if (!resolved) return null;
  if (marketDataToken()) {
    try {
      const live = await liveAnalytics(resolved);
      return { source: "live", ...live };
    } catch (err) {
      console.error(`Live option chain failed for ${symbol}, serving sample analytics:`, err);
    }
  }
  return { source: "sample", analytics: sampleAnalytics(resolved.stock), options: resolved.stock.options };
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("radar")) {
    const syms = parseSymbolsParam(req.nextUrl.searchParams.get("symbols"), 25);
    const universe = syms.length > 0 ? syms : Object.keys(SAMPLE_STOCKS);
    const entries: RadarEntry[] = [];
    for (const sym of universe) {
      try {
        const result = await analyticsFor(sym);
        if (!result) continue;
        const { analytics } = result;
        const positioning = analytics.signals.find((s) => s.name === "Positioning");
        const vol = analytics.signals.find((s) => s.name === "Volatility pricing");
        entries.push({
          sym,
          pcr: analytics.pcr,
          ivAtm: analytics.ivAtm,
          rv20: analytics.rv20,
          ivPremiumPct: analytics.ivPremiumPct,
          positioning: positioning?.state ?? "—",
          tone: positioning?.tone ?? "neu",
          volState: vol?.state ?? "—",
          score: analytics.score,
        });
      } catch (err) {
        console.error(`Radar entry failed for ${sym}:`, err);
      }
    }
    // Strongest positioning first — that's the "what's moving in F&O" view.
    entries.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    return NextResponse.json({ entries });
  }

  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase() ?? "";
  const result = await analyticsFor(symbol);
  if (!result) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 404 });
  }
  return NextResponse.json({ source: result.source, symbol, options: result.options, analytics: result.analytics });
}
