"use client";

// Pulse → Simple cross-fade. Frame 3 of the storyboard: the hero blurs and
// fades while the Simple watchlist rows settle in behind a centered radial
// gold glow. ~300ms, then the parent swaps to the Watchlist surface. Purely
// presentational; it renders over the app during the swap.

import { useEffect } from "react";

export default function PulseTransition({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 320);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 95, background: "#0E1013", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 320,
          height: 320,
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,167,60,0.33), transparent 70%)",
          filter: "blur(20px)",
          animation: "pulseGlow 320ms ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          padding: "80px 20px 0",
          gap: 10,
          opacity: 0,
          animation: "pulseRows 320ms ease forwards",
        }}
      >
        {["settling…", "settling…"].map((_, i) => (
          <div
            key={i}
            style={{
              background: "var(--panel)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 14,
              height: 52,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes pulseRows { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 0.85; transform: none; } }
        @keyframes pulseGlow { from { opacity: 0; } 50% { opacity: 1; } to { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
