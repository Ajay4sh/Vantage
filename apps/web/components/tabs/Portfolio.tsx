"use client";

// Phase 11 — Portfolio Risk Radar view. Portfolio-scoped (ignores the selected
// stock): concentration, correlated bets, combined F&O max-loss vs capital,
// clustered expiry exposure, and a portfolio-wide implied move. Positions come
// from /api/portfolio/positions (a connected broker via the Phase 10 adapter,
// else a labelled demo book). All numbers are risk figures for reflection, not
// advice — and the implied-move aggregate is shown as the lower bound it is.

import { useEffect, useMemo, useState } from "react";
import { useApp } from "../AppProvider";
import MetricTooltip from "../MetricTooltip";
import RiskProfileInput from "../risk/RiskProfileInput";
import RiskDisclaimer from "../risk/RiskDisclaimer";
import { buildPortfolioRadar, type PortfolioPosition } from "@/lib/risk/portfolio";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function Bar({ pct, flagged }: { pct: number; flagged: boolean }) {
  return (
    <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
      <div
        style={{
          width: `${Math.min(100, pct)}%`,
          height: "100%",
          background: flagged ? "var(--neg)" : "var(--gold)",
          borderRadius: 3,
        }}
      />
    </div>
  );
}

export default function Portfolio() {
  const { capital } = useApp();
  const [positions, setPositions] = useState<PortfolioPosition[] | null>(null);
  const [source, setSource] = useState<"live" | "demo">("demo");
  const [broker, setBroker] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/portfolio/positions", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { source: "live" | "demo"; broker?: string; error?: string; positions: PortfolioPosition[] }) => {
        if (cancelled) return;
        setPositions(d.positions ?? []);
        setSource(d.source);
        setBroker(d.broker ?? null);
        setNote(d.error ?? null);
      })
      .catch(() => !cancelled && setPositions([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const radar = useMemo(
    () => (positions ? buildPortfolioRadar(positions, capital) : null),
    [positions, capital],
  );

  if (!radar) {
    return <div style={{ padding: 8, color: "var(--text-3)", fontSize: 12 }}>Loading portfolio…</div>;
  }
  if (radar.positionCount === 0) {
    return (
      <div className="card">
        <div className="card-title">Portfolio Risk Radar</div>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-2)" }}>
          No open positions found. Connect a broker to see aggregate risk across your holdings.
        </p>
        <RiskDisclaimer />
      </div>
    );
  }

  const c = radar.concentration;

  return (
    <>
      {/* Header */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div className="card-title" style={{ margin: 0 }}>
            Portfolio Risk Radar — the whole book, not one position
          </div>
          <span className={`badge ${source === "live" ? "pos" : "neu"}`}>
            {source === "live" ? `LIVE · ${broker}` : "SAMPLE BOOK"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 12, flexWrap: "wrap" }}>
          <div>
            <div className="metric-label">Positions</div>
            <div className="metric-val">{radar.positionCount}</div>
          </div>
          <div>
            <div className="metric-label">Deployed value</div>
            <div className="metric-val">{inr(radar.totalValue)}</div>
          </div>
          <div>
            <div className="metric-label">Risk flags</div>
            <div className="metric-val" style={{ color: radar.flagCount > 0 ? "var(--neg)" : "var(--pos)" }}>
              {radar.flagCount}
            </div>
          </div>
        </div>
        {note && (
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--neg)" }}>
            Broker connected but positions couldn&apos;t be fetched ({note}) — showing a sample book.
          </p>
        )}
      </div>

      {capital == null && (
        <div className="section-gap">
          <RiskProfileInput compact />
        </div>
      )}

      {/* Concentration */}
      <div className="card section-gap">
        <div className="card-title">Concentration — how much of the book each bet is</div>
        <div className="grid-2">
          <div>
            <div className="metric-label" style={{ marginBottom: 8 }}>By name (flag &gt; 25%)</div>
            {c.byName.slice(0, 6).map((s) => (
              <div key={s.label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: s.flagged ? "var(--neg)" : "var(--text-2)" }}>{s.label}</span>
                  <span className="mono" style={{ color: s.flagged ? "var(--neg)" : "var(--text-2)" }}>{s.pct}%</span>
                </div>
                <Bar pct={s.pct} flagged={s.flagged} />
              </div>
            ))}
          </div>
          <div>
            <div className="metric-label" style={{ marginBottom: 8 }}>By sector (flag &gt; 40%)</div>
            {c.bySector.slice(0, 6).map((s) => (
              <div key={s.label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: s.flagged ? "var(--neg)" : "var(--text-2)" }}>{s.label}</span>
                  <span className="mono" style={{ color: s.flagged ? "var(--neg)" : "var(--text-2)" }}>{s.pct}%</span>
                </div>
                <Bar pct={s.pct} flagged={s.flagged} />
              </div>
            ))}
          </div>
        </div>
        {c.flags.length > 0 && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--neg)" }}>
            {c.flags.map((f) => `${f.label} is ${f.pct}% of the book`).join(" · ")} — a large single point of failure.
          </p>
        )}
      </div>

      {/* Correlated bets */}
      <div className="card section-gap">
        <div className="card-title">
          <MetricTooltip term="trend">Correlated bets</MetricTooltip> — positions that move as one
        </div>
        {radar.clusters.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-3)" }}>
            No tightly-correlated clusters detected (pairwise correlation ≥ 0.7 over recent returns). Your positions
            move reasonably independently.
          </p>
        ) : (
          radar.clusters.map((cl) => (
            <div key={cl.symbols.join()} className="driver-row" style={{ alignItems: "flex-start" }}>
              <span className="driver-name">
                <b style={{ color: "var(--text)" }}>{cl.symbols.join(" + ")}</b>
                <span style={{ display: "block", fontSize: 10.5, color: "var(--text-3)" }}>
                  avg correlation {cl.avgCorrelation} — effectively one {cl.pct}% bet, not {cl.symbols.length} separate ones
                </span>
              </span>
              <span className={`badge ${cl.pct > 40 ? "neg" : "neu"}`}>{cl.pct}%</span>
            </div>
          ))
        )}
      </div>

      {/* Combined F&O max-loss */}
      <div className="card section-gap">
        <div className="card-title">
          Combined F&amp;O <MetricTooltip term="max_loss">max loss</MetricTooltip> vs capital
        </div>
        {radar.fno.legs.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-3)" }}>No open options positions.</p>
        ) : (
          <div className="grid-2">
            <div>
              <div className="metric-label">Total defined max loss</div>
              <div className="metric-val" style={{ color: radar.fno.unbounded ? "var(--neg)" : "var(--text)" }}>
                {radar.fno.unbounded ? "Unbounded" : inr(radar.fno.totalMaxLoss)}
              </div>
              {radar.fno.unbounded && (
                <div className="metric-sub" style={{ color: "var(--neg)" }}>
                  A naked short call in the book removes the ceiling on losses — the ₹{radar.fno.totalMaxLoss.toLocaleString("en-IN")} below excludes it.
                </div>
              )}
            </div>
            <div>
              <div className="metric-label">
                <MetricTooltip term="capital_at_risk">% of capital</MetricTooltip>
              </div>
              <div className="metric-val" style={{ color: (radar.fno.pctOfCapital ?? 0) > 20 ? "var(--neg)" : "var(--text)" }}>
                {radar.fno.pctOfCapital !== null ? `${radar.fno.pctOfCapital}%` : capital == null ? "—" : "∞"}
              </div>
              <div className="metric-sub">
                {capital == null ? "set capital above to see this" : radar.fno.unbounded ? "unbounded loss can't be a %" : `of ${inr(capital)}`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expiry exposure */}
      {radar.expiry.length > 0 && (
        <div className="card section-gap">
          <div className="card-title">Expiry-day exposure — same-date risk that stacks up</div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Expiry</th>
                  <th>Positions</th>
                  <th>Combined max loss</th>
                </tr>
              </thead>
              <tbody>
                {radar.expiry.map((e) => (
                  <tr key={e.expiry} className={e.clustered ? "row-hi" : ""}>
                    <td>{e.expiry}{e.clustered ? " •" : ""}</td>
                    <td>{e.positions}</td>
                    <td className={e.clustered ? "down" : ""}>{e.unbounded ? "Unbounded" : inr(e.maxLoss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {radar.expiry.some((e) => e.clustered) && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--neg)" }}>
              • Multiple positions expire on the same day — their risk lands together, not spread out.
            </p>
          )}
        </div>
      )}

      {/* Portfolio implied move */}
      <div className="card section-gap">
        <div className="card-title">
          Portfolio <MetricTooltip term="implied_move">implied move</MetricTooltip> — aggregate ±1SD
        </div>
        <div className="metric-val">
          ± {inr(radar.impliedMove.oneSD)}
          {radar.impliedMove.pctOfValue !== null && (
            <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 400 }}> ({radar.impliedMove.pctOfValue}% of notional)</span>
          )}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.6 }}>
          Combined in quadrature assuming underlyings move independently, so this is a{" "}
          <b style={{ color: "var(--text-2)" }}>lower bound</b>: your correlated positions (see above) make the real
          portfolio swing larger than this. Options are treated at underlying notional (a simplification) — read it as an
          order-of-magnitude, not a precise figure.
        </p>
      </div>

      <RiskDisclaimer />
    </>
  );
}
