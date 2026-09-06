"use client";

// Phase 9, Feature 1 — the Pre-trade Risk Gate. An actual interstitial, not a
// dismissible tooltip: it sits between building a position and "placing" it (a
// paper trade today; a real order later if execution is ever added). It exists
// to add a moment of reflection before a trade — friction by design.
//
// It folds in Feature 2 (embedded position sizing), Feature 4 (the expiry-day
// reflection nudge), and a contextual link to Feature 5 (defined-risk
// education). Undefined-risk positions require a separate, heavier
// acknowledgment — a genuinely different moment from confirming a long option.

import { useState } from "react";
import { useApp } from "../AppProvider";
import MetricTooltip from "../MetricTooltip";
import RiskProfileInput from "./RiskProfileInput";
import RiskDisclaimer from "./RiskDisclaimer";
import DefinedRiskEducation from "./DefinedRiskEducation";
import { computeImpliedMove } from "@/lib/conviction";
import {
  buildReflection,
  capitalAtRiskPct,
  computePositionRisk,
  computeSizing,
  isBuyerSide,
  SIDE_LABELS,
  sizeMultiple,
  type AggStat,
  type TradeSide,
} from "@/lib/risk";
import type { Stock } from "@/lib/types";

export interface GateLeg {
  side: TradeSide;
  strike: number;
  premium: number;
  contracts: number;
}

interface Props {
  stock: Stock;
  leg: GateLeg;
  expiryDayStats: AggStat;
  onClose: () => void;
  onProceed: (leg: GateLeg) => void;
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function PreTradeRiskGate({ stock, leg, expiryDayStats, onClose, onProceed }: Props) {
  const { capital, riskPct } = useApp();
  const [ack, setAck] = useState(false);
  const [showEducation, setShowEducation] = useState(false);

  const lotSize = stock.options.lotSize || 1;
  const risk = computePositionRisk({
    side: leg.side,
    strike: leg.strike,
    premium: leg.premium,
    lotSize,
    contracts: leg.contracts,
    spot: stock.price,
  });

  const capPct = capitalAtRiskPct(risk.maxLoss, capital);
  const sizing =
    capital != null
      ? computeSizing({ capital, riskPct, perContractPremium: risk.perContractPremium })
      : null;
  const multiple = sizing ? sizeMultiple(leg.contracts, sizing.suggestedContracts) : null;

  const move = computeImpliedMove(stock);

  // Same-day expiry if the option's expiry date is today.
  const today = new Date().toISOString().slice(0, 10);
  const sameDayExpiry = stock.options.expiryDate === today;
  const reflection = buildReflection({
    sameDayExpiry,
    capitalRiskPct: capPct,
    riskBudgetPct: riskPct,
    enteredContracts: leg.contracts,
    suggestedContracts: sizing?.suggestedContracts ?? 0,
    expiryDayStats,
  });

  const needsAck = !risk.definedRisk; // undefined-risk (short) legs
  const highRiskBuy = isBuyerSide(leg.side) && capPct !== null && capPct > riskPct;
  const canProceed = !needsAck || ack;

  const maxLossDisplay = risk.maxLossUnbounded
    ? "Unbounded"
    : risk.maxLoss !== null
      ? inr(risk.maxLoss)
      : "—";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 560, maxWidth: "100%", padding: 22, margin: "24px 0" }}
        role="dialog"
        aria-modal="true"
        aria-label="Pre-trade risk review"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div className="display" style={{ fontSize: 19, fontWeight: 700 }}>
            Before you place this trade
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: 16 }}
          >
            ✕
          </button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--text-2)" }}>
          {SIDE_LABELS[leg.side]} · <b>{stock.sym}</b> · {leg.contracts} lot
          {leg.contracts === 1 ? "" : "s"} @ strike ₹{leg.strike} · est. premium ₹{leg.premium} ·{" "}
          {risk.shares.toLocaleString("en-IN")} shares
        </p>

        {/* Max loss + capital at risk — the headline figures */}
        <div
          className="card"
          style={{
            background: risk.definedRisk ? "var(--panel-2)" : "var(--neg-bg)",
            border: risk.definedRisk ? "1px solid var(--border)" : "1px solid #3a1d22",
          }}
        >
          <div className="grid-2" style={{ alignItems: "start" }}>
            <div>
              <div className="metric-label">
                <MetricTooltip term="max_loss">Maximum loss</MetricTooltip>
              </div>
              <div
                className="metric-val"
                style={{ fontSize: 22, color: risk.definedRisk ? "var(--text)" : "var(--neg)" }}
              >
                {maxLossDisplay}
              </div>
              {risk.maxLossUnbounded && (
                <div className="metric-sub" style={{ color: "var(--neg)" }}>
                  A naked short call has no ceiling on losses — the more the stock rises, the more you
                  lose, without limit.
                </div>
              )}
              {!risk.definedRisk && !risk.maxLossUnbounded && (
                <div className="metric-sub" style={{ color: "var(--neg)" }}>
                  Undefined-risk short — bounded only at the strike, still a large multiple of the{" "}
                  {inr(risk.premiumFlow)} premium collected.
                </div>
              )}
            </div>
            <div>
              <div className="metric-label">
                <MetricTooltip term="capital_at_risk">% of your capital</MetricTooltip>
              </div>
              <div className="metric-val" style={{ fontSize: 22 }}>
                {capPct !== null ? `${capPct}%` : risk.maxLossUnbounded ? "∞" : "—"}
              </div>
              <div className="metric-sub">
                {capital == null
                  ? "Set your capital below to see this"
                  : capPct !== null
                    ? `of ${inr(capital)} stated capital`
                    : "can't express an unbounded loss as a %"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>
              <MetricTooltip term="breakeven">Breakeven</MetricTooltip>: <b className="mono">₹{risk.breakeven}</b>
            </span>
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>
              Max profit:{" "}
              <b className="mono">
                {risk.maxProfitUnbounded ? "Unbounded" : risk.maxProfit !== null ? inr(risk.maxProfit) : "—"}
              </b>
            </span>
          </div>
        </div>

        {/* Position sizing (Feature 2) */}
        {sizing && (
          <div className="card section-gap" style={{ background: "var(--panel-2)" }}>
            <div className="card-title" style={{ marginBottom: 6 }}>
              <MetricTooltip term="position_sizing">Position sizing</MetricTooltip> vs your {riskPct}% budget
            </div>
            {risk.definedRisk ? (
              <>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
                  A {riskPct}% risk budget ({inr(sizing.maxRiskAmount)}) suggests up to{" "}
                  <b className="mono" style={{ color: "var(--gold)" }}>
                    {sizing.suggestedContracts} lot{sizing.suggestedContracts === 1 ? "" : "s"}
                  </b>
                  . You're entering <b className="mono">{leg.contracts}</b>.
                </p>
                {multiple !== null && multiple > 1 && (
                  <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--neg)" }}>
                    That's <b>{multiple}×</b> the size this budget would suggest.
                  </p>
                )}
                {sizing.suggestedContracts === 0 && (
                  <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--neg)" }}>
                    Even one lot exceeds your {riskPct}% budget for this trade.
                  </p>
                )}
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
                Sizing to a fixed premium doesn't capture a short's real risk — the loss isn't capped
                at the premium. Treat the max-loss figure above as the number that matters.
              </p>
            )}
          </div>
        )}

        {/* Implied move — reused, framed as the market-priced range */}
        <div className="card section-gap" style={{ background: "var(--panel-2)" }}>
          <div className="card-title" style={{ marginBottom: 6 }}>
            <MetricTooltip term="implied_move">Range the market is pricing in</MetricTooltip> · to{" "}
            {stock.options.expiry} ({move.dte}d)
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
            ~68% chance of landing between{" "}
            <b className="mono">₹{move.range68[0].toFixed(0)}</b> and{" "}
            <b className="mono">₹{move.range68[1].toFixed(0)}</b> (±₹{move.oneSD.toFixed(0)}). This
            position profits or loses depending on where price sits relative to your ₹{risk.breakeven}{" "}
            breakeven — not a prediction of direction.
          </p>
        </div>

        {/* Expiry-day reflection nudge (Feature 4) — a question, never a block */}
        {reflection.show && (
          <div
            className="card section-gap"
            style={{ background: "var(--neg-bg)", border: "1px solid #3a1d22" }}
          >
            <div className="card-title" style={{ color: "#d89aa0", marginBottom: 6 }}>
              A moment on expiry-day risk
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: "#e6b4b9", lineHeight: 1.6 }}>{reflection.message}</p>
          </div>
        )}

        {/* Contextual defined-risk education for high-risk directional buys */}
        {(highRiskBuy || needsAck) && (
          <p style={{ margin: "14px 0 0", fontSize: 12, color: "var(--text-2)" }}>
            There are ways to express a similar view with defined risk.{" "}
            <button
              onClick={() => setShowEducation((v) => !v)}
              style={{
                background: "none",
                border: "none",
                color: "var(--gold)",
                padding: 0,
                fontSize: 12,
                textDecoration: "underline",
              }}
            >
              {showEducation ? "Hide" : "See how"}
            </button>
          </p>
        )}
        {showEducation && (
          <div className="section-gap">
            <DefinedRiskEducation />
          </div>
        )}

        {/* Capital input if not yet set — makes the % above real */}
        {capital == null && (
          <div className="section-gap">
            <RiskProfileInput compact />
          </div>
        )}

        {/* Undefined-risk acknowledgment — separate, heavier moment */}
        {needsAck && (
          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              marginTop: 16,
              padding: "12px 14px",
              background: "var(--neg-bg)",
              border: "1px solid var(--neg)",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: "var(--neg)" }}
            />
            <span style={{ fontSize: 12.5, color: "#e6b4b9", lineHeight: 1.55 }}>
              I understand this is an <b>undefined-risk</b> position: my loss is{" "}
              {risk.maxLossUnbounded ? "not capped and can exceed my capital" : "far larger than the premium I collect"}
              , and I am choosing to proceed anyway.
            </span>
          </label>
        )}

        <RiskDisclaimer />

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onClose}>
            Go back
          </button>
          <button
            className="btn primary"
            style={{ flex: 1, opacity: canProceed ? 1 : 0.5, cursor: canProceed ? "pointer" : "not-allowed" }}
            disabled={!canProceed}
            onClick={() => canProceed && onProceed(leg)}
          >
            Proceed · log as paper trade
          </button>
        </div>
      </div>
    </div>
  );
}
