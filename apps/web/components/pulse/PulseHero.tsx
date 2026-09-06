// Pulse hero — the mood-tinted front-door card. Weather icon + mood word,
// the tide wave, an emotional headline, then NIFTY/SENSEX in mono, secondary
// and small (precision, not emphasis). Tint intensity swaps by mood color
// only, never a new hue. Optional CTA drives the → Simple-mode transition.

import WeatherIcon from "./WeatherIcon";
import MoodWave from "./MoodWave";
import type { MarketPulse } from "@/lib/pulse";

export default function PulseHero({ pulse, cta }: { pulse: MarketPulse; cta?: React.ReactNode }) {
  return (
    <div
      style={{
        background: `linear-gradient(160deg, ${pulse.color}22, #15181D 70%)`,
        border: `1px solid ${pulse.color}33`,
        borderRadius: 22,
        padding: "18px 18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <WeatherIcon mood={pulse.mood} size={40} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            className="mono"
            style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-2)" }}
          >
            Today&apos;s mood
          </span>
          <span className="display" style={{ fontWeight: 600, fontSize: 14, color: pulse.color }}>
            {pulse.word}
          </span>
        </div>
      </div>

      <MoodWave mood={pulse.mood} />

      <p className="display" style={{ margin: 0, fontWeight: 600, fontSize: 19, lineHeight: 1.3, color: "var(--text)" }}>
        {pulse.headline}
      </p>

      <div style={{ display: "flex", gap: 20, marginTop: 2 }}>
        {pulse.indices.map((i) => {
          const up = i.changePct >= 0;
          return (
            <div key={i.name} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 10, color: "var(--text-2)", letterSpacing: "0.04em" }}>{i.name}</span>
              <span className="mono" style={{ fontSize: 14, color: "var(--text)" }}>
                {i.value}{" "}
                <span style={{ color: up ? "var(--pos)" : "var(--neg)" }}>
                  {up ? "+" : ""}
                  {i.changePct.toFixed(2)}%
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {cta}
    </div>
  );
}
