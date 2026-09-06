"use client";

// "Build your first watchlist" — playful, low-stakes, interest-based
// onboarding. The win is personalization, never a financial outcome; card copy
// is descriptive of the company, never price/returns. Drag a card (or tap the
// buttons): right = add, left = skip. Behavior ported from the design spec —
// translateX + rotate, ±90px commit threshold, spring-back, ADD/SKIP stamps
// fading with drag distance.

import { useRef, useState } from "react";
import { ONBOARD_CARDS } from "@/lib/pulse";

const COMMIT = 90;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export default function OnboardingDeck({
  onDone,
  onSkipAll,
}: {
  onDone: (picks: string[]) => void;
  onSkipAll: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<string[]>([]);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const pointerId = useRef<number | null>(null);

  const done = index >= ONBOARD_CARDS.length;
  const card = done ? null : ONBOARD_CARDS[index];
  const hasNext = index + 1 < ONBOARD_CARDS.length;

  function commit(add: boolean) {
    const c = ONBOARD_CARDS[index];
    if (add && c) setPicks((p) => (p.includes(c.ticker) ? p : [...p, c.ticker]));
    setDragX(0);
    setDragging(false);
    setIndex((i) => i + 1);
  }

  function onDown(e: React.PointerEvent) {
    if (done) return;
    startX.current = e.clientX;
    pointerId.current = e.pointerId;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!dragging || pointerId.current !== e.pointerId) return;
    setDragX(e.clientX - startX.current);
  }
  function onUp() {
    if (!dragging) return;
    if (dragX > COMMIT) commit(true);
    else if (dragX < -COMMIT) commit(false);
    else {
      setDragX(0); // spring back
      setDragging(false);
    }
  }

  const addOpacity = clamp01(dragX / 80);
  const skipOpacity = clamp01(-dragX / 80);

  if (done) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="display" style={{ fontWeight: 700, fontSize: 20, color: "var(--text)" }}>
          Your starter watchlist
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
          {picks.length} {picks.length === 1 ? "pick" : "picks"} — add or drop stocks anytime.
        </div>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          {picks.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-2)", padding: "20px 0" }}>
              No picks yet — that&apos;s okay, you can browse anytime.
            </div>
          )}
          {picks.map((ticker) => {
            const c = ONBOARD_CARDS.find((x) => x.ticker === ticker)!;
            return (
              <div
                key={ticker}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--panel)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 14,
                  padding: "12px 14px",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
                    {c.ticker}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-2)" }}>{c.name}</span>
                </div>
                <span
                  style={{ fontSize: 10.5, color: "var(--text-2)", background: "rgba(255,255,255,0.06)", padding: "3px 9px", borderRadius: 20 }}
                >
                  {c.sector}
                </span>
              </div>
            );
          })}
        </div>
        <button
          onClick={() => onDone(picks)}
          style={{
            marginTop: 16,
            width: "100%",
            padding: 15,
            borderRadius: 16,
            background: "var(--gold)",
            color: "#0E1013",
            border: "none",
            fontFamily: "var(--font-display), sans-serif",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          Go to my watchlist →
        </button>
        <button
          onClick={() => {
            setPicks([]);
            setIndex(0);
          }}
          style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--text-2)", background: "none", border: "none" }}
        >
          Start over
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* progress dots */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {ONBOARD_CARDS.map((_, i) => (
          <div
            key={i}
            style={{ flex: 1, height: 4, borderRadius: 2, background: i <= index ? "var(--gold)" : "rgba(255,255,255,0.1)" }}
          />
        ))}
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        {hasNext && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--panel)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 24,
              transform: "scale(0.94) translateY(14px)",
              opacity: 0.55,
            }}
          />
        )}
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--panel)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24,
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow: "0 20px 40px -20px rgba(0,0,0,0.45)",
            cursor: "grab",
            touchAction: "none",
            transform: `translateX(${dragX}px) rotate(${dragX / 16}deg)`,
            transition: dragging ? "none" : "transform 240ms ease",
          }}
        >
          <span
            className="mono"
            style={{
              alignSelf: "flex-start",
              fontSize: 10.5,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-2)",
              background: "rgba(255,255,255,0.06)",
              padding: "4px 10px",
              borderRadius: 20,
            }}
          >
            {card!.sector}
          </span>
          <div className="display" style={{ fontWeight: 700, fontSize: 30, color: "var(--text)" }}>
            {card!.ticker}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: -8 }}>{card!.name}</div>
          <p style={{ marginTop: "auto", marginBottom: 0, fontSize: 15, lineHeight: 1.5, color: "var(--text)" }}>
            {card!.hook}
          </p>

          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              padding: "5px 14px",
              border: "3px solid var(--pos)",
              borderRadius: 8,
              transform: "rotate(-14deg)",
              fontFamily: "var(--font-display), sans-serif",
              fontWeight: 700,
              fontSize: 18,
              color: "var(--pos)",
              opacity: addOpacity,
            }}
          >
            ADD
          </div>
          <div
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              padding: "5px 14px",
              border: "3px solid var(--neg)",
              borderRadius: 8,
              transform: "rotate(14deg)",
              fontFamily: "var(--font-display), sans-serif",
              fontWeight: 700,
              fontSize: 18,
              color: "var(--neg)",
              opacity: skipOpacity,
            }}
          >
            SKIP
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 16 }}>
        <button
          onClick={() => commit(false)}
          aria-label="Skip"
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            background: "var(--panel)",
            border: "1.5px solid rgba(255,255,255,0.12)",
            color: "var(--neg)",
            fontSize: 22,
          }}
        >
          ✕
        </button>
        <button
          onClick={() => commit(true)}
          aria-label="Add"
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--pos)",
            border: "none",
            color: "#0E1013",
            fontSize: 24,
            boxShadow: "0 10px 24px -8px #35B08B88",
          }}
        >
          ♥
        </button>
      </div>

      <button
        onClick={onSkipAll}
        style={{ marginTop: 14, background: "none", border: "none", color: "var(--text-2)", fontSize: 12 }}
      >
        Skip for now
      </button>
    </div>
  );
}
