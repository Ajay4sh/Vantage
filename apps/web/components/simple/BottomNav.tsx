"use client";

// Concept B — persistent bottom nav for the Simple-mode shell. Four items;
// active state shown via the gradient-filled dot (.cb-nav-dot). Pro mode is NOT
// on this nav — it's reached from Profile (per the Phase 7 spec).

export type Surface = "pulse" | "explore" | "alerts" | "profile";

const ICONS: Record<Surface, React.ReactNode> = {
  pulse: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2 6 4-14 2 8h6" />
    </svg>
  ),
  explore: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  alerts: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </svg>
  ),
  profile: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
};

const LABELS: Record<Surface, string> = {
  pulse: "Pulse",
  explore: "Explore",
  alerts: "Alerts",
  profile: "Profile",
};

const ORDER: Surface[] = ["pulse", "explore", "alerts", "profile"];

export default function BottomNav({
  active,
  onChange,
}: {
  active: Surface;
  onChange: (s: Surface) => void;
}) {
  return (
    <nav className="cb-nav" role="tablist" aria-label="Simple mode navigation">
      {ORDER.map((s) => (
        <button
          key={s}
          className="cb-nav-item"
          role="tab"
          aria-selected={active === s}
          aria-label={LABELS[s]}
          onClick={() => onChange(s)}
        >
          {ICONS[s]}
          <span>{LABELS[s]}</span>
          <span className="cb-nav-dot" aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
