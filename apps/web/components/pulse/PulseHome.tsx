"use client";

// Pulse Home — the composed sentiment front door. Header, mood hero (with the
// "Explore the market →" CTA into Simple mode), today's story, the scrollable
// sector-mood row (expands to the 2-column grid), and the onboarding teaser
// that opens the swipeable "build your first watchlist" deck. A share action
// opens the exportable mood snapshot.

import { useEffect, useState } from "react";
import PulseHero from "./PulseHero";
import StoryCard from "./StoryCard";
import { SectorMiniCard, SectorFullCard } from "./SectorMoodCard";
import OnboardingDeck from "./OnboardingDeck";
import ShareSnapshot from "./ShareSnapshot";
import type { MarketPulse, SectorMood } from "@/lib/pulse";

interface Props {
  onExplore: () => void; // hero CTA → Simple mode (with transition)
  onOpenSector: (sector: SectorMood) => void;
  onAddPicks: (tickers: string[]) => void;
  avatar?: React.ReactNode;
}

export default function PulseHome({ onExplore, onOpenSector, onAddPicks, avatar }: Props) {
  const [pulse, setPulse] = useState<MarketPulse | null>(null);
  const [view, setView] = useState<"home" | "sectors" | "onboarding">("home");
  const [share, setShare] = useState(false);
  const [ctaPressed, setCtaPressed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/pulse", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: MarketPulse | null) => {
          if (!cancelled && d) setPulse(d);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  return (
    <div className="mobile-shell">
      {share && pulse && <ShareSnapshot pulse={pulse} onClose={() => setShare(false)} />}

      <div style={{ height: 52, flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "0 20px" }}>
        <div className="brand-mark" style={{ width: 24, height: 24, fontSize: 13 }}>
          V
        </div>
        <span className="display" style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>
          Vantage
        </span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShare(true)}
            aria-label="Share mood"
            disabled={!pulse}
            style={{ background: "none", border: "none", color: "var(--text-2)", fontSize: 16 }}
          >
            ⤴
          </button>
          {avatar}
        </div>
      </div>

      <div className="mobile-main" style={{ paddingBottom: 24 }}>
        {!pulse ? (
          <div style={{ color: "var(--text-3)", fontSize: 13, padding: 20 }}>Reading the market…</div>
        ) : view === "onboarding" ? (
          <div style={{ height: "70vh" }}>
            <OnboardingDeck
              onDone={(picks) => {
                onAddPicks(picks);
                setView("home");
              }}
              onSkipAll={() => setView("home")}
            />
          </div>
        ) : view === "sectors" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span className="display" style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>
                Sector mood
              </span>
              <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 12 }}>
                ← Back
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {pulse.sectors.map((s) => (
                <SectorFullCard key={s.name} sector={s} onTap={() => onOpenSector(s)} />
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <PulseHero
              pulse={pulse}
              cta={
                <button
                  onMouseDown={() => setCtaPressed(true)}
                  onMouseUp={() => setCtaPressed(false)}
                  onMouseLeave={() => setCtaPressed(false)}
                  onClick={onExplore}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: 14,
                    borderRadius: 16,
                    background: "var(--gold)",
                    color: "#0E1013",
                    border: "none",
                    fontFamily: "var(--font-display), sans-serif",
                    fontWeight: 700,
                    fontSize: 14,
                    transform: ctaPressed ? "scale(0.96)" : undefined,
                    boxShadow: ctaPressed ? "0 0 0 7px rgba(212,167,60,0.2)" : undefined,
                    transition: "transform 120ms ease, box-shadow 120ms ease",
                  }}
                >
                  Explore the market →
                </button>
              }
            />

            <StoryCard story={pulse.story} onSeeMoved={() => setView("sectors")} />

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-2)" }}>
                  Sector mood
                </span>
                <button onClick={() => setView("sectors")} style={{ background: "none", border: "none", fontSize: 11.5, color: "var(--gold)" }}>
                  See all →
                </button>
              </div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
                {pulse.sectors.map((s) => (
                  <SectorMiniCard key={s.name} sector={s} onTap={() => setView("sectors")} />
                ))}
              </div>
            </div>

            <button
              onClick={() => setView("onboarding")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(212,167,60,0.08)",
                border: "1px solid rgba(212,167,60,0.2)",
                borderRadius: 14,
                padding: "12px 14px",
                width: "100%",
              }}
            >
              <span style={{ fontSize: 12.5, color: "var(--text)" }}>New here? Build your first watchlist</span>
              <span style={{ fontSize: 14, color: "var(--gold)" }}>→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
