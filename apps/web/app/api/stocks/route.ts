// Full Stock shell for any directory symbol — what the client inserts into
// its watchlist state when a searched instrument is added. Seeded demo names
// return sample data; everything else is a synthesized placeholder that the
// quote poll and module endpoints then keep updated (and overwrite entirely
// in live mode).

import { NextRequest, NextResponse } from "next/server";
import { stockFor } from "@/lib/stock-source";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase() ?? "";
  const resolved = await stockFor(symbol);
  if (!resolved) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 404 });
  }
  return NextResponse.json({ source: resolved.seeded ? "sample" : "synth", stock: resolved.stock });
}
