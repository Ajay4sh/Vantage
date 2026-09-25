"use client";

// Pro redesign — Strategy Builder (two-column, per the PDF). Left: presets +
// editable legs. Right: risk-first summary (defined/undefined banner, max loss
// and max profit as prominent as each other), stats, and the payoff curve.
// "Review order" routes to the gated order ticket — no direct execution here.

import { useEffect, useMemo, useState } from "react";
import PayoffChart from "../charts/PayoffChart";
import { bsGreeks } from "@/lib/options";
import {
  buildStrategy,
  PRESETS,
  presetLegs,
  type PresetContext,
  type PresetId,
  type StrategyLeg,
} from "@/lib/options/strategyBuilder";
import type { OptionsAnalytics, Stock } from "@/lib/types";

const inr = (n: number) => (n < 0 ? "−₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN");

function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? 1 - p : p;
}

export default function StrategyPro({
  stock,
  analytics,
  onReviewOrder,
}: {
  stock: Stock;
  analytics?: OptionsAnalytics;
  onReviewOrder: (summary: string, maxLoss: number | null, maxLossUnbounded: boolean) => void;
}) {
  const ctx: PresetContext = useMemo(() => {
    const exp = new Date(stock.options.expiryDate + "T15:30:00").getTime();
    const dteDays = Math.max(1, Math.ceil((exp - Date.now()) / 86400000));
    return {
      spot: stock.price,
      strikes: stock.options.strikes?.length ? [...stock.options.strikes].sort((a, b) => a - b) : [Math.round(stock.price)],
      lotSize: stock.options.lotSize || 1,
      iv: analytics?.ivAtm ?? stock.options.iv,
      dteDays,
    };
  }, [stock, analytics]);

  const [preset, setPreset] = useState<PresetId>("iron_condor");
  const [legs, setLegs] = useState<StrategyLeg[]>(() => presetLegs("iron_condor", ctx));

  useEffect(() => {
    setLegs(presetLegs(preset, ctx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock.sym]);

  const applyPreset = (id: PresetId) => { setPreset(id); setLegs(presetLegs(id, ctx)); };
  const setLeg = (i: number, patch: Partial<StrategyLeg>) => setLegs((p) => p.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLeg = (i: number) => setLegs((p) => p.filter((_, j) => j !== i));
  const addLeg = () => setLegs((p) => [...p, { type: "call", side: "buy", strike: ctx.strikes[Math.floor(ctx.strikes.length / 2)], premium: 0, qty: 1, lotSize: ctx.lotSize }]);
  const stepStrike = (i: number, dir: 1 | -1) => {
    const l = legs[i];
    const idx = ctx.strikes.findIndex((k) => k >= l.strike);
    const next = ctx.strikes[Math.max(0, Math.min(ctx.strikes.length - 1, (idx < 0 ? 0 : idx) + dir))];
    setLeg(i, { strike: next });
  };

  const r = useMemo(() => buildStrategy(legs, stock.price), [legs, stock.price]);

  // Net greeks across option legs (+ stock delta).
  const greeks = useMemo(() => {
    let delta = 0, theta = 0, vega = 0;
    for (const l of legs) {
      const shares = l.qty * l.lotSize;
      const sign = l.side === "buy" ? 1 : -1;
      if (l.type === "stock") { delta += sign * shares; continue; }
      const g = bsGreeks({ spot: stock.price, strike: l.strike, ivPct: ctx.iv, dteDays: ctx.dteDays });
      delta += sign * (l.type === "call" ? g.callDelta : g.putDelta) * shares;
      theta += sign * (l.type === "call" ? g.callTheta : g.putTheta) * shares;
      vega += sign * g.vega * shares;
    }
    return { delta: Math.round(delta), theta: Math.round(theta), vega: Math.round(vega) };
  }, [legs, stock.price, ctx]);

  // Model prob-of-profit: normal on price at IV over the sampled curve.
  const pop = useMemo(() => {
    const sd = stock.price * (ctx.iv / 100) * Math.sqrt(ctx.dteDays / 365);
    if (sd <= 0) return null;
    let p = 0;
    for (let i = 1; i < r.curve.length; i++) {
      const a = r.curve[i - 1], b = r.curve[i];
      const mid = (a.pnl + b.pnl) / 2;
      if (mid > 0) p += normCdf((b.s - stock.price) / sd) - normCdf((a.s - stock.price) / sd);
    }
    return Math.round(Math.max(0, Math.min(1, p)) * 100);
  }, [r.curve, stock.price, ctx]);

  const rr = r.maxLoss && r.maxLoss !== 0 && r.maxProfit != null ? (r.maxProfit / Math.abs(r.maxLoss)).toFixed(2) : null;
  const summary = `${PRESETS.find((p) => p.id === preset)?.label ?? "Custom"} · ${stock.sym} · ${legs.length} legs · net ${r.netPremium >= 0 ? "credit" : "debit"} ${inr(Math.abs(r.netPremium))}`;

  const Stat = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <div className="metric-label">{label}</div>
      <div className="mono" style={{ fontSize: 14, marginTop: 2 }}>{children}</div>
    </div>
  );

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <div className="pro-h1">Strategy Builder</div>
          <span className="mono" style={{ fontSize: 13, color: "var(--text-2)" }}>{stock.sym} ₹{stock.price.toFixed(2)}</span>
        </div>
        <div className="mono" style={{ fontSize: 12, color: "var(--text-3)" }}>
          Exp {stock.options.expiry} · Lot {ctx.lotSize} · ATM IV {ctx.iv}% · {ctx.dteDays} days left
        </div>
      </div>

      <div className="strat-cols">
        {/* Left */}
        <div>
          <div className="ch-eyebrow" style={{ marginBottom: 8 }}>Preset</div>
          <div className="strat-presets">
            {PRESETS.map((p) => (
              <button key={p.id} className={`seg-tab ${preset === p.id ? "active" : ""}`} title={p.blurb} onClick={() => applyPreset(p.id)}>{p.label}</button>
            ))}
          </div>

          <div className="card section-gap">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div className="card-title" style={{ margin: 0 }}>Legs {legs.length}</div>
              <button onClick={() => setLegs([])} style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: 12, cursor: "pointer" }}>Clear all</button>
            </div>
            {legs.length === 0 && <p style={{ fontSize: 12.5, color: "var(--text-3)" }}>No legs yet. Pick a preset above, or add legs one at a time.</p>}
            {legs.map((l, i) => {
              const otm = l.type === "stock" ? 0 : Math.round(l.strike - stock.price);
              const per = l.premium * l.lotSize * l.qty;
              return (
                <div className="leg-row" key={i}>
                  <div className="seg">
                    <button className={l.side === "buy" ? "on-buy" : ""} onClick={() => setLeg(i, { side: "buy" })}>Buy</button>
                    <button className={l.side === "sell" ? "on-sell" : ""} onClick={() => setLeg(i, { side: "sell" })}>Sell</button>
                  </div>
                  <div className="seg">
                    {(["call", "put"] as const).map((tp) => (
                      <button key={tp} className={l.type === tp ? "on" : ""} onClick={() => setLeg(i, { type: tp })}>{tp === "call" ? "CE" : "PE"}</button>
                    ))}
                    {l.type === "stock" && <button className="on">FUT</button>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {l.type !== "stock" && <button className="pro-btn" style={{ padding: "3px 8px" }} onClick={() => stepStrike(i, -1)}>−</button>}
                    <div style={{ minWidth: 70 }}>
                      <div className="mono" style={{ fontSize: 13 }}>₹{Math.round(l.strike)}</div>
                      {l.type !== "stock" && <div style={{ fontSize: 10, color: "var(--text-3)" }}>OTM {otm >= 0 ? "+" : ""}{otm}</div>}
                    </div>
                    {l.type !== "stock" && <button className="pro-btn" style={{ padding: "3px 8px" }} onClick={() => stepStrike(i, 1)}>+</button>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button className="pro-btn" style={{ padding: "3px 8px" }} onClick={() => setLeg(i, { qty: Math.max(1, l.qty - 1) })}>−</button>
                    <span className="mono" style={{ fontSize: 13 }}>{l.qty}</span>
                    <button className="pro-btn" style={{ padding: "3px 8px" }} onClick={() => setLeg(i, { qty: l.qty + 1 })}>+</button>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {l.type === "stock" ? (
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>futures</span>
                    ) : (
                      <>
                        <div className="mono" style={{ fontSize: 13 }}>₹{l.premium}</div>
                        <div style={{ fontSize: 10, color: l.side === "buy" ? "var(--neg)" : "var(--pos)" }}>{l.side === "buy" ? "pay" : "receive"} {inr(per)}</div>
                      </>
                    )}
                  </div>
                  <button onClick={() => removeLeg(i)} aria-label="Remove leg" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }}>✕</button>
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
              <button className="pro-btn" onClick={addLeg}>＋ Add leg</button>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                Δ {greeks.delta}/pt · Θ {greeks.theta >= 0 ? "+" : ""}{greeks.theta}/day · Vega {greeks.vega >= 0 ? "+" : ""}{greeks.vega} per 1% IV
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="pro-btn gold" style={{ flex: 1 }} disabled={legs.length === 0} onClick={() => onReviewOrder(summary, r.maxLoss, r.maxLossUnbounded)}>Review order</button>
            <button className="pro-btn" onClick={() => {}}>Save strategy</button>
          </div>
        </div>

        {/* Right */}
        <div>
          <div className={`risk-banner ${r.definedRisk ? "defined" : "undefined"}`}>
            <span style={{ fontSize: 18 }}>{r.definedRisk ? "🛡" : "⚠"}</span>
            <div>
              <div style={{ fontWeight: 700, color: r.definedRisk ? "var(--pos)" : "var(--neg)" }}>{r.definedRisk ? "Defined risk" : "Undefined risk"}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 3 }}>
                {legs.length === 0
                  ? "Risk type appears here as soon as you add a leg — defined or undefined, before anything else."
                  : r.definedRisk
                    ? `The most you can lose is ${inr(Math.abs(r.maxLoss ?? 0))}, whatever ${stock.sym} does. That amount is locked in when you enter.`
                    : "Losses are not capped as the underlying runs against you. Treat the max-loss figure as the number that matters."}
              </div>
            </div>
          </div>

          <div className="mp-cards" style={{ marginTop: 14 }}>
            <div className="mp-card mp-loss">
              <div className="metric-label" style={{ color: "#d89aa0" }}>MAX LOSS</div>
              <div className="mono" style={{ fontSize: 26, color: "var(--neg)", fontWeight: 600 }}>{r.maxLossUnbounded ? "Unbounded" : `−${inr(Math.abs(r.maxLoss ?? 0))}`}</div>
            </div>
            <div className="mp-card mp-profit">
              <div className="metric-label" style={{ color: "#8fd3b8" }}>MAX PROFIT</div>
              <div className="mono" style={{ fontSize: 26, color: "var(--pos)", fontWeight: 600 }}>{r.maxProfitUnbounded ? "Unbounded" : `+${inr(r.maxProfit ?? 0)}`}</div>
            </div>
          </div>

          <div className="strat-stats">
            <Stat label="BREAKEVEN">{r.breakevens.length ? r.breakevens.map((b) => "₹" + Math.round(b)).join(" · ") : "—"}</Stat>
            <Stat label={r.netPremium >= 0 ? "NET CREDIT" : "NET DEBIT"}>{inr(Math.abs(r.netPremium))}</Stat>
            <Stat label="PROB. OF PROFIT*">{pop != null ? `${pop}%` : "—"}</Stat>
            <Stat label="RISK : REWARD">{rr ? `1 : ${rr}` : r.maxLossUnbounded ? "undefined" : "—"}</Stat>
          </div>

          <div className="card section-gap">
            <div className="card-title">Payoff at expiry · P&amp;L vs underlying price</div>
            <PayoffChart curve={r.curve} breakevens={r.breakevens} spot={stock.price} />
            <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "var(--text-3)" }}>
              Ticks on the axis mark your strikes. *Probability of profit is a model estimate at {ctx.iv}% IV, not a forecast.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
