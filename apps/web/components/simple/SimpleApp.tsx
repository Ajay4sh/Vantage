"use client";

// Concept B — the Simple-mode shell. Persistent BottomNav over four surfaces
// (Pulse / Explore / Alerts / Profile), a glass front door built from the named
// Concept B components, and stock detail via the existing SimpleView. Pro mode
// is reached from Profile, never from the nav (Phase 7 spec).
//
// Scope: this is the front-door visual layer. Alerts/Profile/detail reuse the
// already-built panels (AlertsPanel, ProfileSurface, SimpleView) for behaviour;
// only the front door (header, hero, watchlist cards, nav) carries the full
// Concept B treatment. Data flow is unchanged — everything comes in via props.

import { useEffect, useState } from "react";
import AppHeader from "./AppHeader";
import PulseHero from "./PulseHero";
import WatchlistCard from "./WatchlistCard";
import BottomNav, { type Surface } from "./BottomNav";
import SimpleView from "../SimpleView";
import AlertsPanel from "../alerts/AlertsPanel";
import ProfileSurface from "../pulse/ProfileSurface";
import type { MarketPulse } from "@/lib/pulse";
import type { Stock } from "@/lib/types";

interface Props {
  rows: Stock[];
  currentSymbol: string;
  onSelect: (sym: string) => void;
  onAdd: (sym: string) => void;
  onExitToPro: () => void;
}

export default function SimpleApp({ rows, currentSymbol, onSelect, onAdd, onExitToPro }: Props) {
  const [surface, setSurface] = useState<Surface>("pulse");
  const [detail, setDetail] = useState<string | null>(null);
  const [pulse, setPulse] = useState<MarketPulse | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/pulse", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: MarketPulse | null) => !cancelled && d && setPulse(d))
        .catch(() => {});
    load();
    const iv = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  const openStock = (sym: string) => {
    onSelect(sym);
    setDetail(sym);
  };

  const goTo = (s: Surface) => {
    setDetail(null);
    setSurface(s);
  };

  const detailStock = detail ? rows.find((r) => r.sym === detail) : null;
  const filtered = query.trim()
    ? rows.filter((r) => (r.sym + " " + r.name + " " + r.sector).toLowerCase().includes(query.toLowerCase()))
    : rows;

  return (
    <div className="concept-b">
      <div className="cb-app">
        {detailStock ? (
          <>
            <div className="cb-header">
              <button className="cb-btn secondary" style={{ width: "auto", padding: "8px 14px" }} onClick={() => setDetail(null)}>
                ← Back
              </button>
              <span className="cb-name" style={{ fontSize: 16 }}>{detailStock.sym}</span>
            </div>
            <div className="cb-main">
              <SimpleView stock={detailStock} />
            </div>
          </>
        ) : (
          <>
            <AppHeader onAvatar={() => goTo("profile")} />
            <div className="cb-main">
              {/* ---- Pulse ---- */}
              {surface === "pulse" && (
                <>
                  {pulse ? (
                    <PulseHero
                      pulse={pulse}
                      cta={
                        <button className="cb-btn" style={{ marginTop: 16 }} onClick={() => goTo("explore")}>
                          Explore the market →
                        </button>
                      }
                    />
                  ) : (
                    <div className="cb-glass cb-hero" style={{ color: "var(--text-secondary)" }}>Reading the market…</div>
                  )}
                  <div className="cb-section-label">Your watchlist</div>
                  {rows.length === 0 ? (
                    <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                      Nothing here yet — head to Explore to add stocks.
                    </p>
                  ) : (
                    rows.map((s) => <WatchlistCard key={s.sym} stock={s} onClick={() => openStock(s.sym)} />)
                  )}
                </>
              )}

              {/* ---- Explore ---- */}
              {surface === "explore" && (
                <>
                  <div className="cb-section-label" style={{ marginTop: 8 }}>Explore</div>
                  <input
                    className="cb-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search a stock, then Enter to add"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && query.trim()) {
                        onAdd(query.trim().toUpperCase());
                        setQuery("");
                      }
                    }}
                    aria-label="Search stocks"
                  />
                  <div style={{ marginTop: 14 }}>
                    {filtered.map((s) => (
                      <WatchlistCard key={s.sym} stock={s} onClick={() => openStock(s.sym)} />
                    ))}
                  </div>
                </>
              )}

              {/* ---- Alerts ---- */}
              {surface === "alerts" && (
                <div style={{ marginTop: 8 }}>
                  <AlertsPanel currentSymbol={currentSymbol} onClose={() => goTo("pulse")} />
                </div>
              )}

              {/* ---- Profile ---- */}
              {surface === "profile" && (
                <div style={{ marginTop: 8 }}>
                  <ProfileSurface currentSymbol={currentSymbol} />
                  <button className="cb-btn" style={{ marginTop: 16 }} onClick={onExitToPro}>
                    Switch to Pro terminal
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <BottomNav active={surface} onChange={goTo} />
      </div>
    </div>
  );
}
