// Phase 2 fundamentals endpoint, dynamic-universe edition. Indices get an
// explicit "doesn't apply" block; equities resolve by ISIN from the
// instrument master. Live: key-ratios + income statement, cached 24h
// (quarterly data — cache aggressively). Sample: seeded data or the honest
// placeholder (all nulls, no fabricated narratives).

import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { stockFor } from "@/lib/stock-source";
import { fetchFundamentals } from "@/lib/upstox/client";
import { marketDataToken } from "@/lib/upstox/token";
import type { Fundamentals } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase() ?? "";
  const resolved = await stockFor(symbol);
  if (!resolved) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 404 });
  }

  if (resolved.entry.kind !== "index" && resolved.entry.isin && marketDataToken()) {
    const isin = resolved.entry.isin;
    try {
      const fundamentals = await cached<Fundamentals>(`fundamentals:v2:${symbol}`, 86400, () =>
        fetchFundamentals(isin),
      );
      return NextResponse.json({ source: "live", symbol, fundamentals });
    } catch (err) {
      console.error(`Live fundamentals fetch failed for ${symbol}, serving sample:`, err);
    }
  }
  return NextResponse.json({ source: "sample", symbol, fundamentals: resolved.stock.fundamentals });
}
