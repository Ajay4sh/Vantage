"use client";

// Phase 9 — the Risk tab. A risk *layer* on top of the Options tab, not a
// replacement: it holds the capital/risk-budget input, a small paper-trade
// builder that opens the Pre-trade Risk Gate, the private loss-pattern mirror,
// and the defined-risk education. Nothing here speeds up or gamifies trading —
// every control adds a step of reflection before a position.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../AppProvider";
import MetricTooltip from "../MetricTooltip";
import LoginSheet from "../auth/LoginSheet";
import RiskProfileInput from "../risk/RiskProfileInput";
import RiskDisclaimer from "../risk/RiskDisclaimer";
import DefinedRiskEducation from "../risk/DefinedRiskEducation";
import LossPatternMirror from "../risk/LossPatternMirror";
import PreTradeRiskGate, { type GateLeg } from "../risk/PreTradeRiskGate";
import { bsPrice } from "@/lib/options";
import {
  computeMirrorStats,
  computePositionRisk,
  computeSizing,
  SIDE_LABELS,
  type TradeSide,
} from "@/lib/risk";
import type { OptionsAnalytics, Stock } from "@/lib/types";
import type { TradeLog } from "@/lib/store";

const SIDES: TradeSide[] = ["buy_call", "buy_put", "sell_call", "sell_put"];
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function Risk({ stock, analytics }: { stock: Stock; analytics?: OptionsAnalytics }) {
  const { user, capital, riskPct } = useApp();

  // ----- shared trade-log state (feeds both the mirror and the gate) -----
  const [trades, setTrades] = useState<TradeLog[]>([]);
  const [authed, setAuthed] = useState(false);
  const [tradesBusy, setTradesBusy] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  const loadTrades = useCallback(async () => {
    setTradesBusy(true);
    try {
      const res = await fetch("/api/trades", { cache: "no-store" });
      const data = (await res.json()) as { trades: TradeLog[]; authed: boolean };
      setTrades(data.trades ?? []);
      setAuthed(!!data.authed);
    } catch {
      setTrades([]);
      setAuthed(false);
    } finally {
      setTradesBusy(false);
    }
  }, []);

  useEffect(() => {
    loadTrades();
  }, [loadTrades, user]);

  const mirrorStats = useMemo(() => computeMirrorStats(trades), [trades]);

  // ----- paper-trade builder -----
  const strikes = stock.options.strikes?.length ? stock.options.strikes : [Math.round(stock.price)];
  const atmIdx = strikes.reduce(
    (best, k, i) => (Math.abs(k - stock.price) < Math.abs(strikes[best] - stock.price) ? i : best),
    0,
  );
  const [side, setSide] = useState<TradeSide>("buy_call");
  const [strike, setStrike] = useState<number>(strikes[atmIdx]);
  const [contracts, setContracts] = useState(1);
  const [premium, setPremium] = useState<string>("");
  const [premiumEdited, setPremiumEdited] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  const dte = useMemo(() => {
    const exp = new Date(stock.options.expiryDate + "T15:30:00");
    return Math.max(1, Math.ceil((exp.getTime() - Date.now()) / 86400000));
  }, [stock.options.expiryDate]);

  const iv = analytics?.ivAtm ?? stock.options.iv;

  // Re-estimate the premium whenever the leg or strike changes (Black-Scholes
  // fair value), unless the user has typed their own — always an editable
  // estimate, never presented as a live quote.
  const estimate = useMemo(
    () => bsPrice(stock.price, strike, iv, dte, side.includes("call") ? "call" : "put"),
    [stock.price, strike, iv, dte, side],
  );
  useEffect(() => {
    setPremium(String(estimate));
    setPremiumEdited(false);
  }, [estimate]);

  const premiumNum = Number(premium.replace(/[^0-9.]/g, "")) || 0;
  const lotSize = stock.options.lotSize || 1;

  const previewRisk = computePositionRisk({
    side,
    strike,
    premium: premiumNum,
    lotSize,
    contracts,
    spot: stock.price,
  });
  const previewSizing =
    capital != null
      ? computeSizing({ capital, riskPct, perContractPremium: previewRisk.perContractPremium })
      : null;

  const leg: GateLeg = { side, strike, premium: premiumNum, contracts };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    marginTop: 6,
    padding: "8px 10px",
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 12,
  };

  return (
    <>
      <RiskProfileInput />

      {/* Paper-trade builder → the gate */}
      <div className="card section-gap">
        <div className="card-title">Paper-trade builder — review the risk before you commit</div>
        <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "var(--text-3)" }}>
          Build a single-leg option position and open the pre-trade risk gate. This is a paper flow —
          nothing is sent to a broker. The point is to see the worst case first.
        </p>
        <div className="grid-2">
          <div>
            <label className="metric-label">Position</label>
            <select value={side} onChange={(e) => setSide(e.target.value as TradeSide)} style={selectStyle}>
              {SIDES.map((s) => (
                <option key={s} value={s}>
                  {SIDE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="metric-label">Strike</label>
            <select value={strike} onChange={(e) => setStrike(Number(e.target.value))} style={selectStyle}>
              {strikes.map((k) => (
                <option key={k} value={k}>
                  ₹{k}
                  {k === strikes[atmIdx] ? " (ATM)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: 10 }}>
          <div>
            <label className="metric-label">
              Premium per share {!premiumEdited && <span style={{ color: "var(--text-3)" }}>(est.)</span>}
            </label>
            <div className="search" style={{ margin: "6px 0 0" }}>
              <span className="mono" style={{ color: "var(--text-3)", fontSize: 12 }}>
                ₹
              </span>
              <input
                value={premium}
                onChange={(e) => {
                  setPremium(e.target.value);
                  setPremiumEdited(true);
                }}
                inputMode="decimal"
                aria-label="Option premium per share"
              />
            </div>
          </div>
          <div>
            <label className="metric-label">
              <MetricTooltip term="lot_size">Contracts (lots)</MetricTooltip>
            </label>
            <div className="search" style={{ margin: "6px 0 0" }}>
              <input
                value={contracts}
                onChange={(e) => setContracts(Math.max(1, Math.round(Number(e.target.value.replace(/[^0-9]/g, "")) || 1)))}
                inputMode="numeric"
                aria-label="Number of contracts"
              />
            </div>
          </div>
        </div>

        {/* Inline sizing + max-loss preview (before the full gate) */}
        <div className="grid-3" style={{ marginTop: 14 }}>
          <div className="card" style={{ background: "var(--panel-2)" }}>
            <div className="metric-label">
              <MetricTooltip term="max_loss">Max loss</MetricTooltip>
            </div>
            <div className="metric-val" style={{ color: previewRisk.definedRisk ? "var(--text)" : "var(--neg)" }}>
              {previewRisk.maxLossUnbounded ? "Unbounded" : inr(previewRisk.maxLoss ?? 0)}
            </div>
          </div>
          <div className="card" style={{ background: "var(--panel-2)" }}>
            <div className="metric-label">
              <MetricTooltip term="breakeven">Breakeven</MetricTooltip>
            </div>
            <div className="metric-val">₹{previewRisk.breakeven}</div>
          </div>
          <div className="card" style={{ background: "var(--panel-2)" }}>
            <div className="metric-label">
              <MetricTooltip term="position_sizing">Budget suggests</MetricTooltip>
            </div>
            <div className="metric-val">
              {previewSizing && previewRisk.definedRisk ? `${previewSizing.suggestedContracts} lot${previewSizing.suggestedContracts === 1 ? "" : "s"}` : "—"}
            </div>
          </div>
        </div>

        <button className="btn primary" style={{ width: "100%", marginTop: 14 }} onClick={() => setGateOpen(true)}>
          Review before trade →
        </button>
      </div>

      {/* Loss-pattern mirror */}
      <div className="section-gap">
        <LossPatternMirror
          trades={trades}
          authed={authed}
          busy={tradesBusy}
          onRequestLogin={() => setShowLogin(true)}
          onChanged={loadTrades}
          defaultSymbol={stock.sym}
          defaultExpiry={stock.options.expiryDate ?? null}
        />
      </div>

      {/* Defined-risk education */}
      <div className="section-gap">
        <DefinedRiskEducation />
      </div>

      <RiskDisclaimer />

      {gateOpen && (
        <PreTradeRiskGate
          stock={stock}
          leg={leg}
          expiryDayStats={mirrorStats.expiryDay}
          onClose={() => setGateOpen(false)}
          onProceed={() => {
            // Paper flow: proceeding doesn't fire an order — it hands the user to
            // the journal so a real position can be logged and later reflected on.
            setGateOpen(false);
            if (!authed) setShowLogin(true);
          }}
        />
      )}

      {showLogin && (
        <LoginSheet
          onClose={() => {
            setShowLogin(false);
            loadTrades();
          }}
        />
      )}
    </>
  );
}
