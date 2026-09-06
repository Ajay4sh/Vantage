// Phase 1 quotes endpoint, dynamic-universe edition. Accepts ?symbols=A,B,C
// (defaults to the seeded demo six). With an Upstox token it proxies the
// Market Quote API for those instruments (Redis-cached, 5s TTL); without one
// it serves the server-side random-walk simulation, which lazily seeds any
// requested symbol from the deterministic synthesizer.
//
// TODO(Phase 1b): swap polling for the Upstox Market Data Feed WebSocket once
// credentials exist to test against.

import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { resolveInstrument } from "@/lib/instruments/master";
import { simulatedSnapshot } from "@/lib/simulation";
import { parseSymbolsParam } from "@/lib/stock-source";
import { fetchLiveQuotes } from "@/lib/upstox/client";
import { marketDataToken } from "@/lib/upstox/token";
import type { QuotesResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbols = parseSymbolsParam(req.nextUrl.searchParams.get("symbols"));

  if (marketDataToken()) {
    try {
      const cacheKey = `quotes:v2:${[...symbols].sort().join(",") || "default"}`;
      const data = await cached<QuotesResponse>(cacheKey, 5, async () => {
        const equityKeys: Record<string, string> = {};
        for (const sym of symbols) {
          const entry = await resolveInstrument(sym);
          if (entry && entry.kind === "equity") equityKeys[sym] = entry.key;
        }
        return fetchLiveQuotes(equityKeys);
      });
      return NextResponse.json(data);
    } catch (err) {
      // Loud in the logs, graceful in the UI: fall back to the simulated feed
      // (clearly badged) rather than a dead terminal.
      console.error("Live quote fetch failed, serving simulated feed:", err);
    }
  }
  return NextResponse.json(simulatedSnapshot(symbols));
}
