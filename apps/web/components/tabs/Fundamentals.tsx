import MetricTooltip from "../MetricTooltip";
import type { Stock } from "@/lib/types";

export default function Fundamentals({ stock }: { stock: Stock }) {
  const f = stock.fundamentals;
  if (stock.kind === "index") {
    return (
      <div className="card">
        <div className="card-title">Not applicable</div>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
          {stock.name} is an index — fundamental ratios (P/E, ROE, margins) apply to its constituent companies, not
          the index itself. See the Technicals and Options tabs for index-level analytics.
        </p>
      </div>
    );
  }
  return (
    <>
      <div className="grid-4">
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="pe_ratio">P/E</MetricTooltip>
          </div>
          <div className="metric-val">{f.pe ?? "—"}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="roe">ROE</MetricTooltip>
          </div>
          <div className="metric-val">{f.roe != null ? `${f.roe}%` : "—"}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="debt_equity">Debt / equity</MetricTooltip>
          </div>
          <div className="metric-val">{f.de ?? "—"}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="eps">EPS (TTM)</MetricTooltip>
          </div>
          <div className="metric-val">{f.eps != null ? `₹${f.eps}` : "—"}</div>
        </div>
      </div>
      <div className="section-gap grid-4">
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="revenue_growth">Revenue growth YoY</MetricTooltip>
          </div>
          {f.revGrowth != null ? (
            <div className={`metric-val ${f.revGrowth >= 0 ? "up" : "down"}`}>
              {f.revGrowth >= 0 ? "+" : ""}
              {f.revGrowth}%
            </div>
          ) : (
            <div className="metric-val">—</div>
          )}
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="dividend_yield">Dividend yield</MetricTooltip>
          </div>
          <div className="metric-val">{f.divYield != null ? `${f.divYield}%` : "—"}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="operating_margin">Operating margin</MetricTooltip>
          </div>
          <div className="metric-val">{f.opMargin != null ? `${f.opMargin}%` : "—"}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="net_margin">Net margin</MetricTooltip>
          </div>
          <div className="metric-val">{f.netMargin != null ? `${f.netMargin}%` : "—"}</div>
        </div>
      </div>
      <div className="section-gap card">
        <div className="card-title">Valuation read</div>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>{f.valuationNote}</p>
      </div>
      {f.capex && (
        <div className="section-gap card">
          <div className="card-title">Capital allocation</div>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>{f.capex}</p>
        </div>
      )}
    </>
  );
}
