import type { SentimentTag, Stock } from "@/lib/types";

const TAG_CLASS: Record<SentimentTag, string> = { positive: "pos", negative: "neg", neutral: "neu" };
const TAG_LABEL: Record<SentimentTag, string> = { positive: "Positive", negative: "Negative", neutral: "Neutral" };

export default function News({ stock }: { stock: Stock }) {
  return (
    <div className="card">
      <div className="card-title">Recent headlines &amp; sentiment tag</div>
      {stock.news.length === 0 && (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-3)" }}>
          No headlines for this instrument yet — live news with sentiment tagging arrives in Phase 4 (Upstox News API
          + classifier). Headlines are never synthesized.
        </p>
      )}
      {stock.news.map((n, idx) => (
        <div className="news-item" key={idx}>
          <div className="news-top">
            <div className="news-headline">{n.h}</div>
            <span className={`badge ${TAG_CLASS[n.tag]}`}>{TAG_LABEL[n.tag]}</span>
          </div>
          <div className="news-meta">
            <span>{n.src}</span>
            <span>·</span>
            <span>{n.when}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
