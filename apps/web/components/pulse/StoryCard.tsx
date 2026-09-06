// Today's story — one editorial narrative a day, the notable thing rather
// than a leaderboard. Gold dot + label, title, an honest 2–3 sentence
// description (what happened, never a prediction), a sector·mood chip, and a
// "See what moved →" affordance into that sector.

import { MOOD_COLOR, MOOD_WORD, type MarketPulse } from "@/lib/pulse";

export default function StoryCard({ story, onSeeMoved }: { story: MarketPulse["story"]; onSeeMoved?: () => void }) {
  const color = MOOD_COLOR[story.mood];
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 20,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)" }} />
        <span
          className="mono"
          style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--gold)", textTransform: "uppercase" }}
        >
          Today&apos;s story
        </span>
      </div>
      <div className="display" style={{ fontWeight: 600, fontSize: 15.5, color: "var(--text)" }}>
        {story.title}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--text-2)" }}>{story.body}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        <span
          className="mono"
          style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: `${color}22`, color }}
        >
          {story.sector} · {MOOD_WORD[story.mood]}
        </span>
        <button
          onClick={onSeeMoved}
          style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 11, color: "var(--text-2)" }}
        >
          See what moved →
        </button>
      </div>
    </div>
  );
}
