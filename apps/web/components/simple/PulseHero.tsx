"use client";

// Concept B — glassmorphism mood card. Radial glow pseudo-element (top-right,
// .cb-pulse-glow), backdrop-blur on the card. Content reuses the existing
// Market Pulse mood computation (lib/pulse via /api/pulse) — no new sentiment
// source. Index stats render as small glass stat blocks.
//
// Guardrail: the glow is decorative structure, static — never triggered by or
// scaled to a price move.

import type { MarketPulse } from "@/lib/pulse";

export default function PulseHero({ pulse, cta }: { pulse: MarketPulse; cta?: React.ReactNode }) {
  return (
    <div className="cb-glass cb-hero">
      <div className="cb-pulse-glow" aria-hidden="true" />
      <div className="cb-mood-label">Today&apos;s mood</div>
      <div className="cb-mood-word">{pulse.word}</div>
      <p className="cb-headline">{pulse.headline}</p>

      <div className="cb-statrow">
        {pulse.indices.slice(0, 3).map((i) => {
          const up = i.changePct >= 0;
          return (
            <div className="cb-stat" key={i.name}>
              <div className="cb-stat-name">{i.name}</div>
              <div className="cb-stat-val cb-data">
                {i.value}{" "}
                <span className={up ? "cb-pos" : "cb-neg"}>
                  {up ? "+" : ""}
                  {i.changePct.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {cta}
    </div>
  );
}
