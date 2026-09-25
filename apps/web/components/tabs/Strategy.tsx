"use client";

// Phase 12 (Gap 3) — options strategy builder (simulation only). Pick a preset
// or edit legs; see the combined payoff curve and the risk figures. Max loss and
// defined/undefined-risk are surfaced as prominently as max profit — the
// deliberate difference from profit-first builders elsewhere, tying into the
// Phase 9 Pre-trade Risk Gate discipline. No execution: nothing here places an
// order.

import { useEffect, useMemo, useState } from "react";
import MetricTooltip from "../MetricTooltip";
import RiskDisclaimer from "../risk/RiskDisclaimer";
import PayoffChart from "../charts/PayoffChart";
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

export default function Strategy({ stock, analytics }: { stock: Stock; analytics?: OptionsAnalytics }) {
  const ctx: PresetContext = useMemo(() => {
    const exp = new Date(stock.options.expiryDate + "T15:30:00").getTime();
    const dteDays = Math.max(1, Math.ceil((exp - Date.now()) / 86400000));
    return {
      spot: stock.price,
      strikes: stock.options.strikes?.length ? stock.options.strikes : [Math.round(stock.price)],
      lotSize: stock.options.lotSize || 1,
      iv: analytics?.ivAtm ?? stock.options.iv,
      dteDays,
    };
  }, [stock, analytics]);

  const [legs, setLegs] = useState<StrategyLeg[]>(() => presetLegs("long_straddle", ctx));
  const [activePreset, setActivePreset] = useState<PresetId>("long_straddle");

  // Rebuild legs when the underlying changes (new context).
  useEffect(() => {
    setLegs(presetLegs(activePreset, ctx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stock.sym]);

  const applyPreset = (id: PresetId) => {
    setActivePreset(id);
    setLegs(presetLegs(id, ctx));
  };

  const result = useMemo(() => buildStrategy(legs, stock.price), [legs, stock.price]);

  const setLeg = (i: number, patch: Partial<StrategyLeg>) =>
    setLegs((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLeg = (i: number) => setLegs((prev) => prev.filter((_, j) => j !== i));
  const addLeg = () =>
    setLegs((prev) => [
      ...prev,
      { type: "call", side: "buy", strike: ctx.strikes[Math.floor(ctx.strikes.length / 2)], premium: 0, qty: 1, lotSize: ctx.lotSize },
    ]);

  const selectStyle: React.CSSProperties = {
    padding: "5px 7px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text)", fontSize: 11.5,
  };

  return (
    <>
      {/* Presets */}
      <div className="card">
        <div className="card-title">Strategy builder — simulate a multi-leg position</div>
        <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "var(--text-3)" }}>
          Pick a template or edit the legs. This simulates the payoff at expiry — no order is placed. Premiums are
          Black-Scholes estimates ({ctx.dteDays} DTE, IV {ctx.iv}%); edit them to match live quotes.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              title={p.blurb}
              style={{
                padding: "8px 11px", borderRadius: 9, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
                border: `1px solid ${activePreset === p.id ? "var(--gold-dim)" : "var(--border)"}`,
                background: activePreset === p.id ? "rgba(212,167,60,0.12)" : "var(--panel-2)",
                color: activePreset === p.id ? "var(--gold)" : "var(--text-2)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Risk-first summary — max loss + risk type as prominent as max profit */}
      <div className="section-gap grid-2">
        <div className="card" style={{ background: "var(--neg-bg)", border: "1px solid #3a1d22" }}>
          <div className="metric-label" style={{ color: "#d89aa0" }}>
            <MetricTooltip term="max_loss">Maximum loss</MetricTooltip>
          </div>
          <div className="metric-val" style={{ fontSize: 24, color: "var(--neg)" }}>
            {result.maxLossUnbounded ? "Unbounded" : inr(result.maxLoss ?? 0)}
          </div>
          <div style={{ marginTop: 8 }}>
            <span className={`badge ${result.definedRisk ? "neu" : "neg"}`}>
              {result.definedRisk ? "DEFINED RISK" : "UNDEFINED RISK"}
            </span>
          </div>
          {!result.definedRisk && (
            <div className="metric-sub" style={{ color: "var(--neg)", marginTop: 6 }}>
              A net short-call leg means losses have no ceiling as the stock rises. Treat this as the number that matters.
            </div>
          )}
        </div>
        <div className="card" style={{ background: "var(--panel-2)" }}>
          <div className="metric-label">Maximum profit</div>
          <div className="metric-val" style={{ fontSize: 24, color: "var(--pos)" }}>
            {result.maxProfitUnbounded ? "Unbounded" : inr(result.maxProfit ?? 0)}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>
              Net {result.netPremium >= 0 ? "credit" : "debit"}: <b className="mono">{inr(Math.abs(result.netPremium))}</b>
            </span>
            <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>
              <MetricTooltip term="breakeven">Breakeven</MetricTooltip>:{" "}
              <b className="mono">{result.breakevens.length ? result.breakevens.map((b) => "₹" + Math.round(b)).join(" / ") : "—"}</b>
            </span>
          </div>
        </div>
      </div>

      {/* Payoff chart */}
      <div className="card section-gap">
        <div className="card-title">Payoff at expiry · P&amp;L vs underlying price</div>
        <PayoffChart curve={result.curve} breakevens={result.breakevens} spot={stock.price} />
      </div>

      {/* Legs editor */}
      <div className="card section-gap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div className="card-title" style={{ margin: 0 }}>Legs</div>
          <button onClick={addLeg} className="btn" style={{ flex: "none", padding: "5px 10px" }}>＋ Add leg</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Side</th><th>Type</th><th>Strike</th><th>Premium</th><th>Lots</th><th></th></tr>
            </thead>
            <tbody>
              {legs.map((l, i) => (
                <tr key={i}>
                  <td>
                    <button onClick={() => setLeg(i, { side: l.side === "buy" ? "sell" : "buy" })} style={{ ...selectStyle, color: l.side === "buy" ? "var(--pos)" : "var(--neg)", cursor: "pointer" }}>
                      {l.side.toUpperCase()}
                    </button>
                  </td>
                  <td>
                    {l.type === "stock" ? (
                      <span style={{ color: "var(--text-3)" }}>stock</span>
                    ) : (
                      <button onClick={() => setLeg(i, { type: l.type === "call" ? "put" : "call" })} style={{ ...selectStyle, cursor: "pointer" }}>
                        {l.type}
                      </button>
                    )}
                  </td>
                  <td>
                    {l.type === "stock" ? (
                      <span className="mono">₹{Math.round(l.strike)}</span>
                    ) : (
                      <select value={l.strike} onChange={(e) => setLeg(i, { strike: Number(e.target.value) })} style={selectStyle}>
                        {ctx.strikes.map((k) => <option key={k} value={k}>₹{k}</option>)}
                      </select>
                    )}
                  </td>
                  <td>
                    {l.type === "stock" ? (
                      <span style={{ color: "var(--text-3)" }}>—</span>
                    ) : (
                      <input
                        value={l.premium}
                        onChange={(e) => setLeg(i, { premium: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
                        style={{ ...selectStyle, width: 70 }}
                        inputMode="decimal"
                        aria-label={`Premium for leg ${i + 1}`}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      value={l.qty}
                      onChange={(e) => setLeg(i, { qty: Math.max(1, Math.round(Number(e.target.value.replace(/[^0-9]/g, "")) || 1)) })}
                      style={{ ...selectStyle, width: 48 }}
                      inputMode="numeric"
                      aria-label={`Lots for leg ${i + 1}`}
                    />
                  </td>
                  <td>
                    <button onClick={() => removeLeg(i)} aria-label="Remove leg" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--text-2)" }}>
          Before you&apos;d act on any structure like this, the same discipline as the <b>Risk</b> tab&apos;s pre-trade gate applies —
          size it to your capital and know the max loss first. This screen is analysis, not an order ticket.
        </p>
      </div>

      <RiskDisclaimer />
    </>
  );
}
