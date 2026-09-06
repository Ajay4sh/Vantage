// Phase 2 technicals endpoint, dynamic-universe edition. Any directory symbol
// works: live mode pulls daily candles from Historical Candle Data (v3) and
// computes RSI/MACD/trend/support-resistance server-side (1h cache); sample
// mode serves the seeded demo data or the synthesized placeholder.

import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { stockFor } from "@/lib/stock-source";
import { buildTechnicals } from "@/lib/technicals";
import { fetchDailyCandles } from "@/lib/upstox/client";
import { marketDataToken } from "@/lib/upstox/token";
import type { Technicals } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase() ?? "";
  const resolved = await stockFor(symbol);
  if (!resolved) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 404 });
  }

  if (marketDataToken()) {
    try {
      const technicals = await cached<Technicals>(`technicals:v2:${symbol}`, 3600, async () =>
        buildTechnicals(await cached(`candles:v2:${symbol}`, 3600, () => fetchDailyCandles(resolved.entry.key))),
      );
      return NextResponse.json({ source: "live", symbol, technicals });
    } catch (err) {
      console.error(`Live technicals fetch failed for ${symbol}, serving sample:`, err);
    }
  }
  return NextResponse.json({ source: "sample", symbol, technicals: resolved.stock.technicals });
}
