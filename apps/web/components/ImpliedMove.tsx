"use client";

// Port of the demo's impliedMoveHtml(). Keep the framing exactly as-is: this
// is the range the options market is pricing in — a probability band, not a
// directional prediction. Don't let copy edits drift it toward "forecast".

import { computeImpliedMove } from "@/lib/conviction";
import type { Stock } from "@/lib/types";

export default function ImpliedMove({ stock }: { stock: Stock }) {
  const m = computeImpliedMove(stock);
  const fmt = (v: number) => "₹" + v.toFixed(2);
  const pctOfPrice = ((m.oneSD / stock.price) * 100).toFixed(1);

  // Position markers along a 0-100 track spanning the 95% range
  const lo = m.range95[0];
  const hi = m.range95[1];
  const span = hi - lo;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));

  return (
    <div className="card">
      <div className="card-title">
        Implied move to expiry · {stock.options.expiry} ({m.dte} days)
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--text-3)" }}>
        Derived from current IV ({stock.options.iv}%) using Price × IV × √(DTE/365). This is the range the options
        market is pricing in — a probability band, not a prediction of where the stock will land.
      </p>
      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div className="card" style={{ background: "var(--panel-2)" }}>
          <div className="metric-label">~68% probability range (±1 SD)</div>
          <div className="metric-val" style={{ fontSize: 15 }}>
            {fmt(m.range68[0])} – {fmt(m.range68[1])}
          </div>
          <div className="metric-sub">
            ±{fmt(m.oneSD)} ({pctOfPrice}% of spot)
          </div>
        </div>
        <div className="card" style={{ background: "var(--panel-2)" }}>
          <div className="metric-label">~95% probability range (±2 SD)</div>
          <div className="metric-val" style={{ fontSize: 15 }}>
            {fmt(m.range95[0])} – {fmt(m.range95[1])}
          </div>
          <div className="metric-sub">±{fmt(m.oneSD * 2)}</div>
        </div>
      </div>
      <div style={{ position: "relative", height: 34, marginTop: 6 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 16, height: 3, background: "var(--border)", borderRadius: 2 }} />
        <div
          style={{
            position: "absolute",
            top: 16,
            height: 3,
            borderRadius: 2,
            background: "rgba(212,167,60,0.35)",
            left: `${pos(m.range68[0])}%`,
            width: `${pos(m.range68[1]) - pos(m.range68[0])}%`,
          }}
        />
        <div style={{ position: "absolute", top: 9, width: 2, height: 17, background: "var(--gold)", left: `${pos(stock.price)}%` }} />
        <div style={{ position: "absolute", top: -14, fontSize: 9, color: "var(--text-3)", left: 0 }}>{fmt(lo)}</div>
        <div
          style={{
            position: "absolute",
            top: -14,
            fontSize: 9,
            color: "var(--gold)",
            left: `${pos(stock.price)}%`,
            transform: "translateX(-50%)",
          }}
        >
          spot
        </div>
        <div style={{ position: "absolute", top: -14, fontSize: 9, color: "var(--text-3)", right: 0 }}>{fmt(hi)}</div>
      </div>
    </div>
  );
}
