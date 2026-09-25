"use client";

// Pro redesign — Scanners section. Landing: five scan cards (top matches +
// counts) and a "flagged by 2+ scanners" confluence row. Detail: the full match
// table with why-it-matched. Analysis only — "Open" goes to the stock view, no
// trade action on a result.

import { useEffect, useState } from "react";
import { SCANNERS_META } from "@/lib/scanners/meta";
import type { ScanMatch, ScannerId } from "@/lib/scanners/types";

interface AllData {
  perScanner: Record<string, { label: string; description: string; matches: ScanMatch[] }>;
  confluence: { sym: string; chgPct: number; tags: string[] }[];
}

function chg(n: number) {
  return (
    <span className={n >= 0 ? "up" : "down"}>
      {n >= 0 ? "▲ +" : "▼ "}
      {Math.abs(n)}%
    </span>
  );
}

export default function ScannersPro({ onOpen }: { onOpen: (sym: string) => void }) {
  const [all, setAll] = useState<AllData | null>(null);
  const [detail, setDetail] = useState<ScannerId | null>(null);

  useEffect(() => {
    fetch("/api/scanners", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: AllData) => setAll(d))
      .catch(() => {});
  }, []);

  const now = new Date().toLocaleTimeString("en-GB");

  if (detail && all) {
    const d = all.perScanner[detail];
    return (
      <>
        <div className="seg-tabs" style={{ marginBottom: 16 }}>
          <button className="seg-tab" onClick={() => setDetail(null)}>← All scanners</button>
          {SCANNERS_META.map((m) => (
            <button key={m.id} className={`seg-tab ${detail === m.id ? "active" : ""}`} onClick={() => setDetail(m.id)}>
              {m.label} {all.perScanner[m.id]?.matches.length ?? 0}
            </button>
          ))}
        </div>
        <div className="pro-h1" style={{ fontSize: 22 }}>{d.label}</div>
        <p style={{ color: "var(--text-3)", fontSize: 12.5, margin: "6px 0 16px" }}>
          {d.description}. {d.matches.length} matches · computed over a curated NSE universe (synthesized history until live credentials).
        </p>
        <div className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Symbol</th><th>Sector</th><th>LTP</th><th>Change</th><th>Why this matched</th><th></th></tr>
            </thead>
            <tbody>
              {d.matches.map((m) => (
                <tr key={m.sym}>
                  <td style={{ fontWeight: 600 }}>{m.sym}</td>
                  <td>{m.sector}</td>
                  <td>₹{m.price.toFixed(2)}</td>
                  <td>{chg(m.chgPct)}</td>
                  <td style={{ fontFamily: "var(--font-body)", color: "var(--text-2)" }}>{m.detail}</td>
                  <td><button className="pro-btn" style={{ padding: "5px 12px" }} onClick={() => onOpen(m.sym)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
        <div>
          <div className="pro-h1">Scanners</div>
          <p style={{ color: "var(--text-3)", fontSize: 13, margin: "6px 0 0" }}>Pick a scan to see every match and why it was flagged.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-3)" }}>
          <span className="mono"><span style={{ color: "var(--pos)" }}>●</span> Live · NSE · {now}</span>
        </div>
      </div>

      {!all ? (
        <div style={{ padding: 20, color: "var(--text-3)" }}>Running scanners…</div>
      ) : (
        <>
          <div className="scan-grid" style={{ marginTop: 16 }}>
            {SCANNERS_META.map((m) => {
              const s = all.perScanner[m.id];
              const matches = s?.matches ?? [];
              return (
                <div className="scan-card" key={m.id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div className="scan-card-ico">{m.icon}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{matches.length} matches</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 11.5, color: "var(--text-3)", margin: "0 0 8px", minHeight: 30 }}>{m.description}</p>
                  <div style={{ flex: 1 }}>
                    {matches.slice(0, 3).map((x) => (
                      <div className="scan-row" key={x.sym}>
                        <span style={{ fontWeight: 600 }}>{x.sym}</span>
                        <span className={x.metric >= 0 ? "up" : "down"}>{m.id === "volume" ? `${x.metric}×` : m.id === "cross" ? "Today" : `${x.metric >= 0 ? "+" : ""}${x.metric}%`}</span>
                      </div>
                    ))}
                    {matches.length === 0 && <div style={{ fontSize: 11.5, color: "var(--text-3)", padding: "6px 0" }}>No matches right now.</div>}
                  </div>
                  <button className="scan-viewall" onClick={() => setDetail(m.id)} disabled={matches.length === 0}>
                    View all {matches.length} matches →
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "26px 0 4px", flexWrap: "wrap", gap: 8 }}>
            <div className="pro-h1" style={{ fontSize: 18 }}>Flagged by 2+ scanners</div>
            <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>Confluence often matters more than any single signal</span>
          </div>
          {all.confluence.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: 12.5 }}>Nothing showing up on multiple scans right now.</p>
          ) : (
            <div className="conf-grid">
              {all.confluence.map((c) => (
                <div className="conf-card" key={c.sym} onClick={() => onOpen(c.sym)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700 }}>{c.sym}</span>
                    <span style={{ fontSize: 12 }}>{chg(c.chgPct)}</span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    {c.tags.map((t) => <span className="tag" key={t}>{t}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p style={{ margin: "16px 0 0", fontSize: 10.5, color: "var(--text-3)" }}>
            Synthesized history until live credentials are connected — analysis only, not a signal to trade.
          </p>
        </>
      )}
    </>
  );
}
