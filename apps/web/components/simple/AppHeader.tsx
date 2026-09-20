"use client";

// Concept B — app header: time-based greeting + gradient avatar circle
// (per the demo's .b-header). The avatar opens Profile. Purely presentational;
// no personalization we don't actually have (no fabricated name).

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function AppHeader({ onAvatar }: { onAvatar?: () => void }) {
  return (
    <header className="cb-header">
      <div className="cb-greeting">
        <span className="cb-hi">{greeting()}</span>
        <span className="cb-name">Your markets</span>
      </div>
      <button className="cb-avatar" aria-label="Open profile" onClick={onAvatar}>
        V
      </button>
    </header>
  );
}
