// Phase 12 (Gap 1) — OHLCV candles for the candlestick chart. Live mode pulls
// ~220 daily candles from Upstox Historical Candle Data (1h cache); demo mode
// serves deterministic synthesized candles (ending at the seeded/synth spot) so
// the chart, moving averages, and Bollinger Bands have real depth to draw
// without credentials. Analysis only — no order data.

import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { SAMPLE_STOCKS } from "@/lib/sample-data";
import { stockFor } from "@/lib/stock-source";
import { synthCandles, synthSpot } from "@/lib/synth";
import { fetchDailyCandles } from "@/lib/upstox/client";
import { marketDataToken } from "@/lib/upstox/token";
import type { Candle } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase() ?? "";
  const resolved = await stockFor(symbol);
  if (!resolved) return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 404 });

  if (marketDataToken()) {
    try {
      const candles = await cached<Candle[]>(`candles:v3:${symbol}`, 3600, () =>
        fetchDailyCandles(resolved.entry.key),
      );
      return NextResponse.json({ source: "live", symbol, candles });
    } catch (err) {
      console.error(`Live candles fetch failed for ${symbol}, serving synth:`, err);
    }
  }

  const seeded = SAMPLE_STOCKS[symbol];
  const spot = seeded ? seeded.price : synthSpot(symbol);
  const candles = synthCandles(symbol, spot, 220);
  return NextResponse.json({ source: seeded ? "sample" : "synth", symbol, candles });
}
