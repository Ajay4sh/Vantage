"use client";

// Phase 9, Feature 1/2 — the capital + risk-budget input. Deliberately framed
// not as an onboarding form but as "the denominator that makes every other
// number on this screen meaningful". Captured once, editable anytime, and
// stored via AppProvider (localStorage when anonymous, DB when signed in).

import { useEffect, useState } from "react";
import { useApp } from "../AppProvider";
import MetricTooltip from "../MetricTooltip";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export default function RiskProfileInput({ compact = false }: { compact?: boolean }) {
  const { capital, riskPct, setRiskProfile } = useApp();
  const [capText, setCapText] = useState(capital != null ? String(capital) : "");
  const [pctText, setPctText] = useState(String(riskPct));

  // Reflect external changes (e.g. adopting server prefs after login).
  useEffect(() => {
    setCapText(capital != null ? String(capital) : "");
  }, [capital]);
  useEffect(() => {
    setPctText(String(riskPct));
  }, [riskPct]);

  const commitCapital = () => {
    const v = Number(capText.replace(/[^0-9.]/g, ""));
    setRiskProfile({ capital: capText.trim() === "" ? null : Number.isFinite(v) ? v : null });
  };
  const commitPct = () => {
    const v = Number(pctText.replace(/[^0-9.]/g, ""));
    const clamped = Number.isFinite(v) ? Math.max(0.1, Math.min(v, 100)) : 2;
    setRiskProfile({ riskPct: clamped });
    setPctText(String(clamped));
  };

  const budget = capital != null ? Math.round(capital * (riskPct / 100)) : null;

  return (
    <div className="card">
      <div className="card-title">
        Your risk profile — the denominator for everything below
      </div>
      <div className="grid-2" style={{ alignItems: "end" }}>
        <div>
          <label className="metric-label">Trading capital (₹)</label>
          <div className="search" style={{ margin: "6px 0 0" }}>
            <span className="mono" style={{ color: "var(--text-3)", fontSize: 12 }}>
              ₹
            </span>
            <input
              value={capText}
              onChange={(e) => setCapText(e.target.value)}
              onBlur={commitCapital}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              placeholder="e.g. 100000"
              inputMode="numeric"
              aria-label="Trading capital in rupees"
            />
          </div>
        </div>
        <div>
          <label className="metric-label">
            <MetricTooltip term="risk_budget">Risk budget per trade (%)</MetricTooltip>
          </label>
          <div className="search" style={{ margin: "6px 0 0" }}>
            <input
              value={pctText}
              onChange={(e) => setPctText(e.target.value)}
              onBlur={commitPct}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              placeholder="2"
              inputMode="decimal"
              aria-label="Risk budget percentage per trade"
            />
            <span className="mono" style={{ color: "var(--text-3)", fontSize: 12 }}>
              %
            </span>
          </div>
        </div>
      </div>
      {capital != null ? (
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-2)" }}>
          A {riskPct}% budget means you're risking up to{" "}
          <b className="mono" style={{ color: "var(--gold)" }}>
            {inr(budget!)}
          </b>{" "}
          on any one position.
        </p>
      ) : (
        !compact && (
          <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "var(--text-3)" }}>
            Set your capital once and every max-loss below turns into a share of what you actually
            have — the number that decides whether a bad trade is a scratch or a real dent.
          </p>
        )
      )}
    </div>
  );
}
