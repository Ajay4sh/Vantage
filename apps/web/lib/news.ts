// Phase 4 — headline sourcing. NewsAPI.org when NEWSAPI_KEY is set (the build
// doc's supplementary source), else null so the route serves the seeded demo
// headlines. Sentiment is added separately (lib/sentiment.ts) — this module
// only fetches raw headlines.
//
// TODO: Upstox's News API is the primary source per the build doc §2; add it
// here behind the Upstox token once verified against a live response, keeping
// this same RawHeadline shape.

export interface RawHeadline {
  h: string;
  src: string;
  when: string;
}

export function newsConfigured(): boolean {
  return !!process.env.NEWSAPI_KEY;
}

function relativeWhen(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "Recent";
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface NewsApiArticle {
  title?: unknown;
  source?: { name?: unknown };
  publishedAt?: unknown;
}

/** Recent English headlines for a company, newest first. Returns null when
 *  unconfigured; throws only on an unexpected upstream error (the route falls
 *  back to sample news either way). */
export async function fetchHeadlines(name: string, limit = 5): Promise<RawHeadline[] | null> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return null;

  const q = encodeURIComponent(`"${name}"`);
  const url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=${limit}`;
  const res = await fetch(url, { headers: { "X-Api-Key": key }, cache: "no-store" });
  if (!res.ok) throw new Error(`NewsAPI request failed: ${res.status} ${await res.text()}`);

  const body = (await res.json()) as { status?: string; articles?: unknown };
  if (body.status !== "ok" || !Array.isArray(body.articles)) {
    throw new Error("NewsAPI response shape changed — refusing to parse it silently");
  }

  return (body.articles as NewsApiArticle[])
    .filter((a) => typeof a.title === "string" && a.title)
    .slice(0, limit)
    .map((a) => ({
      h: String(a.title),
      src: typeof a.source?.name === "string" ? a.source.name : "News",
      when: relativeWhen(String(a.publishedAt ?? "")),
    }));
}
