"use client";

// Simple-mode watchlist — the calm list that Pulse's "Explore the market →"
// lands on. One row per watched stock: weather-icon mood (from composite
// conviction), ticker + name, and mono price/change. A Simple/Pro pill in the
// header lets the user opt into the dense terminal — Pro is never preselected
// when arriving from Pulse.

import WeatherIcon from "./WeatherIcon";
import { computeConviction } from "@/lib/conviction";
import { moodFromScore } from "@/lib/pulse";
import { useApp } from "../AppProvider";
import type { Stock } from "@/lib/types";

export default function SimpleWatchlist({
  stocks,
  onOpen,
}: {
  stocks: Stock[];
  onOpen: (sym: string) => void;
}) {
  const { mode, setMode } = useApp();

  return (
    <div className="mobile-shell">
      <div style={{ height: 60, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="brand-mark" style={{ width: 24, height: 24, fontSize: 13 }}>
            V
          </div>
          <span className="display" style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
            Vantage
          </span>
        </div>
        <div className="mode-toggle" role="group" aria-label="View mode">
          <button className={mode === "simple" ? "active" : ""} onClick={() => setMode("simple")}>
            Simple
          </button>
          <button className={mode === "pro" ? "active" : ""} onClick={() => setMode("pro")}>
            Pro
          </button>
        </div>
      </div>

      <div className="mobile-main" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stocks.map((s) => {
          const mood = moodFromScore(computeConviction(s).score);
          const up = s.chg >= 0;
          return (
            <button
              key={s.sym}
              onClick={() => onOpen(s.sym)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--panel)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16,
                padding: "13px 15px",
                width: "100%",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <WeatherIcon mood={mood} size={20} rays={false} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
                    {s.sym}
                  </span>
                  <span style={{ fontSize: 10.5, color: "var(--text-2)" }}>{s.name}</span>
                </div>
              </div>
              <span className="mono" style={{ fontSize: 13, color: up ? "var(--pos)" : "var(--neg)" }}>
                {up ? "+" : ""}
                {s.chgPct.toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
