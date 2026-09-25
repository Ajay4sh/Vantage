"use client";

// Pro redesign — the top-nav shell (per the PDF). Sections: Markets (the stock
// view with sub-tabs), Watchlist, Scanners, Strategy Builder, Portfolio. Search
// and the section nav live in the top bar; the left watchlist rail is gone.
// Simple mode (Concept B) is unaffected — Terminal renders that separately.

import { useEffect, useRef, useState } from "react";
import { useApp } from "../AppProvider";
import LoginSheet from "../auth/LoginSheet";
import AlertsPanel from "../alerts/AlertsPanel";
import Overview from "../tabs/Overview";
import Options from "../tabs/Options";
import Technicals from "../tabs/Technicals";
import Fundamentals from "../tabs/Fundamentals";
import Risk from "../tabs/Risk";
import News from "../tabs/News";
import Portfolio from "../tabs/Portfolio";
import ConvictionGauge from "../ConvictionGauge";
import ResearchNote from "../ResearchNote";
import ScannersPro from "./ScannersPro";
import StrategyPro from "./StrategyPro";
import OrderTicket from "./OrderTicket";
import type { IndexQuote, OptionsAnalytics, QuoteSource, Stock } from "@/lib/types";

type Section = "markets" | "watchlist" | "scanners" | "strategy" | "portfolio";
type SubTab = "overview" | "options" | "technicals" | "fundamentals" | "risk" | "news";

const SECTIONS: [Section, string][] = [
  ["markets", "Markets"],
  ["watchlist", "Watchlist"],
  ["scanners", "Scanners"],
  ["strategy", "Strategy Builder"],
  ["portfolio", "Portfolio"],
];
const SUBTABS: [SubTab, string][] = [
  ["overview", "Overview"],
  ["options", "Options"],
  ["technicals", "Technicals"],
  ["fundamentals", "Fundamentals"],
  ["risk", "Risk"],
  ["news", "News"],
];

interface Props {
  rows: Stock[];
  current: Stock;
  currentSymbol: string;
  indices: IndexQuote[];
  source: QuoteSource | null;
  analytics: Record<string, OptionsAnalytics>;
  watchlist: string[];
  onSelect: (sym: string) => void;
  onAdd: (sym: string) => void;
  onRemove: (sym: string) => void;
}

interface OrderState {
  kind: "equity" | "strategy";
  side?: "buy" | "sell";
  summary?: string;
  maxLoss?: number | null;
  maxLossUnbounded?: boolean;
}

export default function ProTerminal(p: Props) {
  const { user, authReady, mode, toggleMode, logout } = useApp();
  const [section, setSection] = useState<Section>("markets");
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [order, setOrder] = useState<OrderState | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [menu, setMenu] = useState(false);

  // Search
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ sym: string; name: string }[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const id = setTimeout(() => {
      fetch(`/api/instruments?q=${encodeURIComponent(q)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d: { results: { sym: string; name: string }[] }) => setResults(d.results ?? []))
        .catch(() => {});
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  const openStock = (sym: string) => { p.onAdd(sym); setSection("markets"); setSubTab("overview"); setQ(""); setResults([]); };

  const nifty = p.indices.find((i) => /nifty 50|nifty/i.test(i.name)) ?? p.indices[0];
  const c = p.current;
  const up = c.chg >= 0;
  const avatar = user ? user.phone.replace(/\D/g, "").slice(-2) : "AJ";

  return (
    <>
      {showLogin && <LoginSheet onClose={() => setShowLogin(false)} />}
      {showAlerts && <AlertsPanel currentSymbol={p.currentSymbol} onClose={() => setShowAlerts(false)} />}
      {order && (
        <OrderTicket
          kind={order.kind}
          symbol={p.currentSymbol}
          spot={c.price}
          defaultSide={order.side}
          summary={order.summary}
          maxLoss={order.maxLoss}
          maxLossUnbounded={order.maxLossUnbounded}
          onClose={() => setOrder(null)}
        />
      )}

      {/* Top nav */}
      <nav className="pro-nav">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div className="brand-name">Vantage</div>
        </div>
        <div className="pro-links">
          {SECTIONS.map(([s, label]) => (
            <button key={s} className={`pro-link ${section === s ? "active" : ""}`} onClick={() => setSection(s)}>{label}</button>
          ))}
        </div>
        <div className="pro-nav-right">
          {nifty && (
            <span className="pro-ticker">
              NIFTY <b>{Math.round(nifty.value).toLocaleString("en-IN")}</b>{" "}
              <span className={nifty.changePct >= 0 ? "up" : "down"}>{nifty.changePct >= 0 ? "▲" : "▼"} {Math.abs(nifty.changePct).toFixed(2)}%</span>
            </span>
          )}
          <div className="pro-search" ref={searchRef}>
            <span style={{ color: "var(--text-3)" }}>⌕</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stocks, F&O" aria-label="Search stocks"
              onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) openStock(q.trim().toUpperCase()); }} />
            {results.length > 0 && (
              <div className="pro-search-results">
                {results.slice(0, 8).map((rz) => (
                  <div className="pro-search-item" key={rz.sym} onClick={() => openStock(rz.sym)}>
                    <b>{rz.sym}</b><span style={{ color: "var(--text-3)", fontSize: 11.5, textAlign: "right" }}>{rz.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mode-toggle" role="group" aria-label="View mode">
            <button className={mode === "simple" ? "active" : ""} onClick={() => mode !== "simple" && toggleMode()}>Simple</button>
            <button className={mode === "pro" ? "active" : ""} onClick={() => mode !== "pro" && toggleMode()}>Pro</button>
          </div>
          {user && (
            <button className="pro-btn" style={{ padding: "7px 10px" }} onClick={() => setShowAlerts(true)} aria-label="Alerts">🔔</button>
          )}
          <div style={{ position: "relative" }}>
            <button className="pro-avatar" onClick={() => (user ? setMenu((v) => !v) : setShowLogin(true))}>{avatar}</button>
            {menu && user && (
              <div className="pro-search-results" style={{ left: "auto", right: 0, width: 180, top: 44 }}>
                <div className="pro-search-item" style={{ color: "var(--text-3)", fontSize: 11.5, cursor: "default" }}>{user.phone}</div>
                <div className="pro-search-item" onClick={() => { logout(); setMenu(false); }}>Sign out</div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="pro-body">
        {/* ===== Markets ===== */}
        {section === "markets" && (
          <>
            <div className="pro-stockhead">
              <div>
                <div className="pro-sh-sym">{c.sym} <span className="pro-sh-badge">{c.kind === "index" ? "IDX" : "NSE"}</span></div>
                <div className="pro-sh-name">{c.name} · {c.kind === "index" ? "Index" : c.sector}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ textAlign: "right" }}>
                  <div className="pro-sh-price">₹{c.price.toFixed(2)}</div>
                  <div className={`mono ${up ? "up" : "down"}`} style={{ fontSize: 13 }}>{up ? "▲ +" : "▼ "}{Math.abs(c.chg).toFixed(2)} ({up ? "+" : ""}{c.chgPct.toFixed(2)}%)</div>
                </div>
                <button className="pro-btn" onClick={() => p.onAdd(c.sym)}>Add to watchlist</button>
                {c.kind !== "index" && <button className="pro-btn gold" onClick={() => setOrder({ kind: "equity", side: "buy" })}>Trade</button>}
              </div>
            </div>

            <div className="pro-subtabs">
              {SUBTABS.map(([id, label]) => (
                <div key={id} className={`tab ${subTab === id ? "active" : ""}`} onClick={() => setSubTab(id)}>{label}</div>
              ))}
            </div>

            <div style={{ paddingTop: 18 }}>
              {subTab === "overview" && (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 20, alignItems: "start" }}>
                  <Overview stock={c} />
                  <div>
                    <ConvictionGauge stock={c} />
                    <ResearchNote key={c.sym} stock={c} analytics={p.analytics[c.sym]} />
                  </div>
                </div>
              )}
              {subTab === "options" && <Options stock={c} analytics={p.analytics[c.sym]} onSelect={p.onSelect} radarSymbols={p.watchlist} />}
              {subTab === "technicals" && <Technicals stock={c} />}
              {subTab === "fundamentals" && <Fundamentals stock={c} />}
              {subTab === "risk" && <Risk stock={c} analytics={p.analytics[c.sym]} />}
              {subTab === "news" && <News stock={c} />}
            </div>
          </>
        )}

        {/* ===== Watchlist ===== */}
        {section === "watchlist" && (
          <>
            <div className="pro-h1">Watchlist</div>
            <div className="card section-gap" style={{ overflowX: "auto" }}>
              <table>
                <thead><tr><th>Symbol</th><th>Sector</th><th>Price</th><th>Change</th><th></th></tr></thead>
                <tbody>
                  {p.rows.map((s) => {
                    const u = s.chg >= 0;
                    return (
                      <tr key={s.sym} style={{ cursor: "pointer" }} onClick={() => { p.onSelect(s.sym); setSection("markets"); }}>
                        <td style={{ fontWeight: 600 }}>{s.sym}</td>
                        <td>{s.sector}</td>
                        <td>₹{s.price.toFixed(2)}</td>
                        <td className={u ? "up" : "down"}>{u ? "+" : ""}{s.chgPct.toFixed(2)}%</td>
                        <td>{p.watchlist.length > 1 && <button onClick={(e) => { e.stopPropagation(); p.onRemove(s.sym); }} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }}>✕</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ===== Scanners ===== */}
        {section === "scanners" && <ScannersPro onOpen={openStock} />}

        {/* ===== Strategy Builder ===== */}
        {section === "strategy" && (
          <StrategyPro
            stock={c}
            analytics={p.analytics[c.sym]}
            onReviewOrder={(summary, maxLoss, maxLossUnbounded) => setOrder({ kind: "strategy", summary, maxLoss, maxLossUnbounded })}
          />
        )}

        {/* ===== Portfolio ===== */}
        {section === "portfolio" && (<><div className="pro-h1" style={{ marginBottom: 16 }}>Portfolio</div><Portfolio /></>)}
      </div>
    </>
  );
}
