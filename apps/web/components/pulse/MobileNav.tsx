// App-level bottom navigation for the mobile surfaces: Pulse / Markets /
// Watchlist / Profile. Icons ported from the design (heartbeat pulse, bars,
// bookmark, circle). The active tab is gold.

export type Surface = "pulse" | "markets" | "watchlist" | "profile";

const GOLD = "#D4A73C";
const DIM = "#9BA0A9";

function Icon({ surface, active }: { surface: Surface; active: boolean }) {
  const c = active ? GOLD : DIM;
  if (surface === "pulse") {
    return (
      <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden>
        <path d="M1,10 L6,10 L8,4 L12,16 L14,10 L19,10" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (surface === "markets") {
    return (
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 14 }}>
        <div style={{ width: 3, height: 8, background: c, borderRadius: 1 }} />
        <div style={{ width: 3, height: 14, background: c, borderRadius: 1 }} />
        <div style={{ width: 3, height: 10, background: c, borderRadius: 1 }} />
      </div>
    );
  }
  if (surface === "watchlist") {
    return <div style={{ width: 13, height: 16, background: c, clipPath: "polygon(0 0,100% 0,100% 100%,50% 78%,0 100%)" }} />;
  }
  return <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${c}` }} />;
}

const LABELS: Record<Surface, string> = { pulse: "Pulse", markets: "Markets", watchlist: "Watchlist", profile: "Profile" };

export default function MobileNav({ active, onChange }: { active: Surface; onChange: (s: Surface) => void }) {
  return (
    <div
      style={{
        height: 62,
        flexShrink: 0,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: "var(--panel)",
      }}
    >
      {(["pulse", "markets", "watchlist", "profile"] as Surface[]).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none" }}
        >
          <Icon surface={s} active={active === s} />
          <span style={{ fontSize: 9.5, color: active === s ? GOLD : DIM }}>{LABELS[s]}</span>
        </button>
      ))}
    </div>
  );
}
