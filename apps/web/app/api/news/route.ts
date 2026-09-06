// Phase 4 — news + sentiment. With NEWSAPI_KEY set, pulls recent headlines and
// tags each (Claude when ANTHROPIC_API_KEY is set, keyword heuristic otherwise),
// cached 3h per ticker. Without a news key, serves the seeded demo headlines
// (or an empty list for un-seeded instruments — headlines are never synthesized).

import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { fetchHeadlines, newsConfigured } from "@/lib/news";
import { classifyHeadlines } from "@/lib/sentiment";
import { stockFor } from "@/lib/stock-source";
import type { NewsItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase() ?? "";
  const resolved = await stockFor(symbol);
  if (!resolved) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 404 });
  }

  if (newsConfigured()) {
    try {
      const news = await cached<NewsItem[]>(`news:v1:${symbol}`, 3 * 3600, async () => {
        const raw = (await fetchHeadlines(resolved.entry.name)) ?? [];
        if (raw.length === 0) return [];
        const tags = await classifyHeadlines(raw.map((r) => r.h), symbol);
        return raw.map((r, i) => ({ h: r.h, tag: tags[i], src: r.src, when: r.when }));
      });
      // Empty live result → fall through to seeded headlines rather than a blank tab.
      if (news.length > 0) return NextResponse.json({ source: "live", symbol, news });
    } catch (err) {
      console.error(`Live news fetch failed for ${symbol}, serving sample:`, err);
    }
  }

  return NextResponse.json({ source: "sample", symbol, news: resolved.stock.news });
}
