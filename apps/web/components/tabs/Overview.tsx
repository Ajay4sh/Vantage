import MetricTooltip from "../MetricTooltip";
import type { Stock } from "@/lib/types";

export default function Overview({ stock }: { stock: Stock }) {
  const s = stock;
  return (
    <>
      <div className="grid-4">
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="pe_ratio">P/E ratio</MetricTooltip>
          </div>
          <div className="metric-val">{s.fundamentals.pe ?? "—"}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="rsi">RSI (14)</MetricTooltip>
          </div>
          <div className="metric-val">{s.technicals.rsi}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="pcr">Options PCR</MetricTooltip>
          </div>
          <div className="metric-val">{s.options.pcr}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="dividend_yield">Div. yield</MetricTooltip>
          </div>
          <div className="metric-val">{s.fundamentals.divYield != null ? `${s.fundamentals.divYield}%` : "—"}</div>
        </div>
      </div>
      <div className="section-gap card">
        <div className="card-title">Snapshot</div>
        <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--text-2)" }}>{s.technicals.note}</p>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>{s.fundamentals.valuationNote}</p>
      </div>
      <div className="section-gap grid-2">
        <div className="card">
          <div className="card-title">Technical read</div>
          <div className="driver-row">
            <span className="driver-name">
              <MetricTooltip term="trend">Trend</MetricTooltip>
            </span>
            <span>{s.technicals.trend}</span>
          </div>
          <div className="driver-row">
            <span className="driver-name">
              <MetricTooltip term="support">Support</MetricTooltip>
            </span>
            <span className="mono">₹{s.technicals.support.join(" / ₹")}</span>
          </div>
          <div className="driver-row">
            <span className="driver-name">
              <MetricTooltip term="resistance">Resistance</MetricTooltip>
            </span>
            <span className="mono">₹{s.technicals.resistance.join(" / ₹")}</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Options read</div>
          <div className="driver-row">
            <span className="driver-name">Expiry</span>
            <span className="mono">{s.options.expiry}</span>
          </div>
          <div className="driver-row">
            <span className="driver-name">
              <MetricTooltip term="max_pain">Max pain</MetricTooltip>
            </span>
            <span className="mono">₹{s.options.maxPain}</span>
          </div>
          <div className="driver-row">
            <span className="driver-name">
              <MetricTooltip term="iv">IV context</MetricTooltip>
            </span>
            <span style={{ textAlign: "right", maxWidth: "60%" }}>{s.options.ivRank}</span>
          </div>
        </div>
      </div>
    </>
  );
}
