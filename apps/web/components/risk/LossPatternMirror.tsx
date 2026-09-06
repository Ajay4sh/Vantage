"use client";

// Phase 9, Feature 3 — the Personal Loss-Pattern Mirror. A private, per-user
// reflection surface: the user's own aggregate stats (win rate, P&L by strategy
// and by expiry proximity) set against SEBI's published findings. Framed as
// "here's how your pattern compares," never as a score, grade, or leaderboard —
// and never shared. Includes the self-log form that feeds it (broker import is
// out of scope this phase).

import { useState } from "react";
import RiskDisclaimer from "./RiskDisclaimer";
import { computeMirrorStats, SEBI_FINDINGS, SIDE_LABELS, type AggStat } from "@/lib/risk";
import type { TradeLog } from "@/lib/store";

const STRATEGY_OPTIONS: { value: string; label: string }[] = [
  { value: "buy_call", label: SIDE_LABELS.buy_call },
  { value: "buy_put", label: SIDE_LABELS.buy_put },
  { value: "sell_call", label: SIDE_LABELS.sell_call },
  { value: "sell_put", label: SIDE_LABELS.sell_put },
  { value: "covered_call", label: "Covered call" },
  { value: "credit_spread", label: "Credit spread" },
  { value: "other", label: "Other" },
];

const inr = (n: number) => (n < 0 ? "−₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN");

function pnlColor(n: number | null): string {
  if (n === null || n === 0) return "var(--text-2)";
  return n > 0 ? "var(--pos)" : "var(--neg)";
}

function StatLine({ label, stat }: { label: string; stat: AggStat }) {
  return (
    <div className="driver-row">
      <span className="driver-name">
        {label} <span style={{ color: "var(--text-3)" }}>· {stat.count} logged</span>
      </span>
      <span style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
          {stat.winRate !== null ? `${stat.winRate}% win` : "no closes"}
        </span>
        <span className="mono" style={{ fontSize: 12, color: pnlColor(stat.totalPnl) }}>
          {stat.winRate !== null ? inr(stat.totalPnl) : "—"}
        </span>
      </span>
    </div>
  );
}

interface Props {
  trades: TradeLog[];
  authed: boolean;
  busy: boolean;
  onRequestLogin: () => void;
  onChanged: () => void;
  defaultSymbol: string;
  defaultExpiry: string | null;
}

export default function LossPatternMirror({
  trades,
  authed,
  busy,
  onRequestLogin,
  onChanged,
  defaultSymbol,
  defaultExpiry,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [strategy, setStrategy] = useState("buy_call");
  const [expiry, setExpiry] = useState(defaultExpiry ?? "");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [pnl, setPnl] = useState("");
  const [saving, setSaving] = useState(false);

  const stats = computeMirrorStats(trades);

  async function submit() {
    if (!symbol.trim()) return;
    setSaving(true);
    try {
      const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(/[^0-9.-]/g, "")));
      await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          strategyType: strategy,
          expiryDate: expiry || null,
          entryPrice: num(entry),
          exitPrice: num(exit),
          pnl: num(pnl),
        }),
      });
      setEntry("");
      setExit("");
      setPnl("");
      setShowForm(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/trades?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    onChanged();
  }

  if (!authed) {
    return (
      <div className="card">
        <div className="card-title">Your loss-pattern mirror — private to you</div>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>
          Keep a private journal of your own trades and see how your pattern compares to SEBI's
          findings on individual F&amp;O traders. It's a mirror, not a leaderboard — never shared,
          never public.
        </p>
        <button className="btn primary" onClick={onRequestLogin}>
          Sign in to keep a private trade log
        </button>
        <RiskDisclaimer />
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="card-title" style={{ margin: 0 }}>
          Your loss-pattern mirror — private to you
        </div>
        <button className="btn" style={{ flex: "none", padding: "6px 12px" }} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Log a trade"}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ background: "var(--panel-2)", marginBottom: 14 }}>
          <div className="grid-2">
            <div>
              <label className="metric-label">Symbol</label>
              <div className="search" style={{ margin: "6px 0 0" }}>
                <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="RELIANCE" />
              </div>
            </div>
            <div>
              <label className="metric-label">Strategy</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: "8px 10px",
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text)",
                  fontSize: 12,
                }}
              >
                {STRATEGY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-3" style={{ marginTop: 10 }}>
            <div>
              <label className="metric-label">Entry price</label>
              <div className="search" style={{ margin: "6px 0 0" }}>
                <input value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="—" inputMode="decimal" />
              </div>
            </div>
            <div>
              <label className="metric-label">Exit price</label>
              <div className="search" style={{ margin: "6px 0 0" }}>
                <input value={exit} onChange={(e) => setExit(e.target.value)} placeholder="open" inputMode="decimal" />
              </div>
            </div>
            <div>
              <label className="metric-label">P&amp;L (₹)</label>
              <div className="search" style={{ margin: "6px 0 0" }}>
                <input value={pnl} onChange={(e) => setPnl(e.target.value)} placeholder="open" inputMode="numeric" />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label className="metric-label">Expiry date (optional)</label>
            <div className="search" style={{ margin: "6px 0 0" }}>
              <input value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="YYYY-MM-DD" />
            </div>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 10.5, color: "var(--text-3)" }}>
            Leave P&amp;L blank while the trade is open. Log it honestly — this only helps if it's real.
          </p>
          <button
            className="btn primary"
            style={{ width: "100%", marginTop: 12 }}
            disabled={saving || !symbol.trim()}
            onClick={submit}
          >
            {saving ? "Saving…" : "Save to journal"}
          </button>
        </div>
      )}

      {busy ? (
        <p style={{ fontSize: 12, color: "var(--text-3)" }}>Loading your journal…</p>
      ) : trades.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>
          No trades logged yet. Log a few — including the losers — and this mirror will show your own
          win rate and P&amp;L by strategy and by expiry proximity, next to what SEBI found across all
          individual F&amp;O traders.
        </p>
      ) : (
        <>
          <StatLine label="Overall" stat={stats.overall} />
          <StatLine label="As a buyer (long options)" stat={stats.buyers} />
          <StatLine label="As a seller / spreads" stat={stats.sellers} />
          <StatLine label="Expiry-day trades" stat={stats.expiryDay} />
          <StatLine label="Held past expiry day" stat={stats.swing} />

          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              background: "var(--panel-2)",
              borderRadius: 8,
              borderLeft: "2px solid var(--gold-dim)",
            }}
          >
            <div className="card-title" style={{ marginBottom: 6 }}>
              How that compares — SEBI's findings
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
              {SEBI_FINDINGS.lossRate}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
              {SEBI_FINDINGS.buyersVsSellers}
              {stats.buyers.winRate !== null && stats.sellers.winRate !== null && (
                <>
                  {" "}
                  Your buyer win rate is <b>{stats.buyers.winRate}%</b> vs{" "}
                  <b>{stats.sellers.winRate}%</b> as a seller.
                </>
              )}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "var(--text-3)" }}>
              {SEBI_FINDINGS.source} Shown for reflection, not prediction — your history is your own.
            </p>
          </div>

          {/* Recent entries */}
          <div style={{ marginTop: 14 }}>
            <div className="card-title" style={{ marginBottom: 6 }}>
              Recent entries
            </div>
            {trades.slice(0, 8).map((t) => (
              <div className="driver-row" key={t.id}>
                <span className="driver-name">
                  <b style={{ color: "var(--text)" }}>{t.symbol}</b>{" "}
                  <span style={{ color: "var(--text-3)" }}>
                    {(SIDE_LABELS as Record<string, string>)[t.strategyType]?.split(" (")[0] ?? t.strategyType}
                    {t.expiryDate ? ` · exp ${t.expiryDate}` : ""}
                  </span>
                </span>
                <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span className="mono" style={{ fontSize: 12, color: pnlColor(t.pnl) }}>
                    {t.pnl !== null ? inr(t.pnl) : "open"}
                  </span>
                  <button
                    onClick={() => remove(t.id)}
                    aria-label="Delete entry"
                    style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: 13 }}
                  >
                    ✕
                  </button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <RiskDisclaimer>
        Private to you — never shared, never a public leaderboard. A mirror for reflection, not a
        score or a grade. Not investment advice.
      </RiskDisclaimer>
    </div>
  );
}
