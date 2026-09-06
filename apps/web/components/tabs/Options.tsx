"use client";

// Options tab: demo layout (metric cards, implied move, OI chart, IV context)
// plus the Phase 3 analytics — discrete signals, ATM greeks, and the F&O
// radar. All numbers arrive computed from /api/options; this component only
// displays them.

import { useEffect, useState } from "react";
import ImpliedMove from "../ImpliedMove";
import MetricTooltip from "../MetricTooltip";
import OIChart from "../charts/OIChart";
import type { OptionsAnalytics, RadarEntry, Stock } from "@/lib/types";

interface Props {
  stock: Stock;
  analytics?: OptionsAnalytics;
  onSelect?: (sym: string) => void;
  radarSymbols?: string[];
}

function SignalsCard({ analytics }: { analytics: OptionsAnalytics }) {
  return (
    <div className="card">
      <div className="card-title">Options signals — what the market is pricing</div>
      <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "var(--text-3)" }}>
        Read from open interest and volatility pricing. These describe current positioning, not where the stock will
        go — not trade advice.
      </p>
      {analytics.signals.map((sig) => (
        <div className="driver-row" key={sig.name} style={{ alignItems: "flex-start", gap: 10 }}>
          <span className="driver-name" style={{ whiteSpace: "nowrap", paddingTop: 3 }}>
            {sig.name}
          </span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, textAlign: "right" }}>
            <span className={`badge ${sig.tone}`}>{sig.state}</span>
            <span style={{ fontSize: 10.5, color: "var(--text-3)", maxWidth: 420 }}>{sig.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function GreeksCard({ analytics }: { analytics: OptionsAnalytics }) {
  return (
    <div className="card">
      <div className="card-title">
        Greeks around ATM · Black-Scholes ({analytics.dte} DTE{analytics.source === "sample" ? ", synthetic smile" : ", chain IV"})
      </div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Strike</th>
              <th>
                <MetricTooltip term="iv">IV %</MetricTooltip>
              </th>
              <th>
                <MetricTooltip term="delta">Call Δ</MetricTooltip>
              </th>
              <th>
                <MetricTooltip term="delta">Put Δ</MetricTooltip>
              </th>
              <th>
                <MetricTooltip term="gamma">Γ</MetricTooltip>
              </th>
              <th>
                <MetricTooltip term="theta">Θ/day</MetricTooltip>
              </th>
              <th>
                <MetricTooltip term="vega">Vega</MetricTooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {analytics.greeks.map((g) => (
              <tr key={g.strike} className={g.atm ? "row-hi" : ""}>
                <td>₹{g.strike}{g.atm ? " •" : ""}</td>
                <td>{g.iv}</td>
                <td className="up">{g.callDelta}</td>
                <td className="down">{g.putDelta}</td>
                <td>{g.gamma}</td>
                <td>{g.callTheta}</td>
                <td>{g.vega}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RadarCard({
  currentSym,
  onSelect,
  symbols,
}: {
  currentSym: string;
  onSelect?: (sym: string) => void;
  symbols?: string[];
}) {
  const [entries, setEntries] = useState<RadarEntry[] | null>(null);
  const symsParam = symbols?.join(",") ?? "";

  useEffect(() => {
    let cancelled = false;
    const url = symsParam
      ? `/api/options?radar=1&symbols=${encodeURIComponent(symsParam)}`
      : "/api/options?radar=1";
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { entries: RadarEntry[] } | null) => {
        if (!cancelled && data) setEntries(data.entries);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symsParam]);

  return (
    <div className="card">
      <div className="card-title">F&amp;O radar — universe ranked by strength of positioning</div>
      {!entries ? (
        <div style={{ padding: 8, color: "var(--text-3)", fontSize: 12 }}>Loading…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>
                  <MetricTooltip term="pcr">PCR</MetricTooltip>
                </th>
                <th>
                  <MetricTooltip term="iv">ATM IV</MetricTooltip>
                </th>
                <th>
                  <MetricTooltip term="realized_vol">20d RV</MetricTooltip>
                </th>
                <th>Positioning</th>
                <th>
                  <MetricTooltip term="iv_premium">Premium</MetricTooltip>
                </th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.sym}
                  className={e.sym === currentSym ? "row-hi" : ""}
                  style={{ cursor: onSelect ? "pointer" : "default" }}
                  onClick={() => onSelect?.(e.sym)}
                >
                  <td style={{ fontWeight: 600 }}>{e.sym}</td>
                  <td>{e.pcr}</td>
                  <td>{e.ivAtm}%</td>
                  <td>{e.rv20 != null ? `${e.rv20}%` : "—"}</td>
                  <td>
                    <span className={`badge ${e.tone}`}>{e.positioning}</span>
                  </td>
                  <td>{e.volState}</td>
                  <td className={e.score > 10 ? "up" : e.score < -10 ? "down" : ""}>
                    {e.score > 0 ? "+" : ""}
                    {e.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "var(--text-3)" }}>
        Score = PCR tilt + max-pain pull, -100..100. Ranks how one-sided current positioning is — not a
        recommendation queue.
      </p>
    </div>
  );
}

export default function Options({ stock, analytics, onSelect, radarSymbols }: Props) {
  const o = stock.options;
  return (
    <>
      <div className="grid-4">
        <div className="card">
          <div className="metric-label">Expiry</div>
          <div className="metric-val" style={{ fontSize: 14 }}>
            {o.expiry}
          </div>
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="lot_size">Lot size</MetricTooltip>
          </div>
          <div className="metric-val">{o.lotSize}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="pcr">Put/call ratio</MetricTooltip>
          </div>
          <div className="metric-val">{o.pcr}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="iv">IV{analytics ? " (ATM)" : ""}</MetricTooltip>
          </div>
          <div className="metric-val">{analytics ? analytics.ivAtm : o.iv}%</div>
        </div>
      </div>
      {analytics && (
        <div className="section-gap">
          <SignalsCard analytics={analytics} />
        </div>
      )}
      <div className="section-gap">
        <ImpliedMove stock={stock} />
      </div>
      <div className="section-gap card">
        <div className="card-title">Open interest by strike — calls above axis, puts below</div>
        <OIChart strikes={o.strikes} callOI={o.callOI} putOI={o.putOI} sym={stock.sym} />
        {analytics && (
          <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "var(--text-3)" }}>
            Max pain ₹{analytics.maxPain} · heaviest put OI (support) ₹{analytics.oiSupport} · heaviest call OI
            (resistance) ₹{analytics.oiResistance} — computed server-side from this chain.
          </p>
        )}
      </div>
      {analytics && (
        <div className="section-gap">
          <GreeksCard analytics={analytics} />
        </div>
      )}
      <div className="section-gap">
        <RadarCard currentSym={stock.sym} onSelect={onSelect} symbols={radarSymbols} />
      </div>
      <div className="section-gap card">
        <div className="card-title">IV context</div>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>{o.ivRank}</p>
      </div>
    </>
  );
}
