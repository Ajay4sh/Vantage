// Market Pulse snapshot — the sentiment front door's data. Assembles the six
// sector moods, the market mood, headline, and today's story from the same
// stock/index data the terminal uses (live via Upstox when configured, the
// simulated feed otherwise). Auto/Pharma resolve through the synth placeholder
// so all six sector cards are real. 30s cache — mood doesn't need to churn.

import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { computeMarketPulse, PULSE_SECTORS, type MarketPulse } from "@/lib/pulse";
import { simulatedSnapshot } from "@/lib/simulation";
import { stockFor } from "@/lib/stock-source";
import { fetchLiveQuotes } from "@/lib/upstox/client";
import { marketDataToken } from "@/lib/upstox/token";
import type { IndexQuote, Stock } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await cached<MarketPulse>("pulse:v1", 30, async () => {
    const symbols = Array.from(new Set(PULSE_SECTORS.flatMap((s) => s.symbols)));

    // Resolve every sector's stocks (seeded or synth) once.
    const stocksBySymbol: Record<string, Stock> = {};
    for (const sym of symbols) {
      const resolved = await stockFor(sym);
      if (resolved) stocksBySymbol[sym] = resolved.stock;
    }

    // Overlay fresh prices + indices from the live/simulated feed so the mood
    // reflects the current session, not the static seed.
    let indices: IndexQuote[] = [];
    try {
      const snap = marketDataToken() ? await fetchLiveQuotes() : simulatedSnapshot(symbols);
      indices = snap.indices;
      for (const [sym, q] of Object.entries(snap.quotes)) {
        const s = stocksBySymbol[sym];
        if (s) stocksBySymbol[sym] = { ...s, price: q.price, chg: q.chg, chgPct: q.chgPct };
      }
    } catch (err) {
      console.error("pulse: quote overlay failed, using seed prices", err);
    }

    return computeMarketPulse({ stocksBySymbol, indices });
  });

  return NextResponse.json(data);
}
