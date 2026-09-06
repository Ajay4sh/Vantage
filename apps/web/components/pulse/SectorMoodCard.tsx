// Sector mood card. Two forms share the same mood language:
//  - "mini" for the horizontally-scrolling row on Pulse Home
//  - "full" for the 2-column grid detail, with an active/tapped ring state
//    and a "Tap to see all …" affordance.

import WeatherIcon from "./WeatherIcon";
import type { SectorMood } from "@/lib/pulse";

export function SectorMiniCard({ sector, onTap }: { sector: SectorMood; onTap?: () => void }) {
  return (
    <button
      onClick={onTap}
      style={{
        flex: "0 0 auto",
        width: 110,
        textAlign: "left",
        background: `linear-gradient(160deg, ${sector.color}22, #15181D 75%)`,
        border: `1px solid ${sector.color}33`,
        borderRadius: 16,
        padding: 11,
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <WeatherIcon mood={sector.mood} size={18} rays={false} />
      <span className="display" style={{ fontWeight: 600, fontSize: 12.5, color: "var(--text)" }}>
        {sector.name}
      </span>
      <span
        className="mono"
        style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.04em", color: sector.color }}
      >
        {sector.mood.toUpperCase()}
      </span>
    </button>
  );
}

export function SectorFullCard({ sector, active, onTap }: { sector: SectorMood; active?: boolean; onTap?: () => void }) {
  return (
    <button
      onClick={onTap}
      style={{
        textAlign: "left",
        background: `linear-gradient(160deg, ${sector.color}1f, #15181D 78%)`,
        border: `1px solid ${sector.color}33`,
        borderRadius: 18,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transform: active ? "scale(1.03)" : undefined,
        boxShadow: active ? `0 0 0 2px ${sector.color}66, 0 16px 30px -14px ${sector.color}4d` : undefined,
        transition: "transform 160ms ease, box-shadow 160ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <WeatherIcon mood={sector.mood} size={22} rays={false} />
        <span
          className="mono"
          style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", color: sector.color }}
        >
          {sector.mood.toUpperCase()}
        </span>
      </div>
      <span className="display" style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
        {sector.name}
      </span>
      <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: "var(--text-2)" }}>{sector.summary}</p>
      {active && (
        <span style={{ fontSize: 10.5, color: sector.color, marginTop: 2 }}>Tap to see all {sector.name} stocks →</span>
      )}
    </button>
  );
}
