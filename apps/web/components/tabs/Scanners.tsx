"use client";

// Phase 12 (Gap 2) — Scanners screen. Pick a scanner, see matching stocks from
// the universe (server-computed, short-cached), each result opening the existing
// per-stock view. Analysis only — no trade action attached to a result.

import { useEffect, useState } from "react";
import { SCANNERS_META } from "@/lib/scanners/meta";
import type { ScanMatch, ScannerId } from "@/lib/scanners/types";

export default function Scanners({ onOpen }: { onOpen: (sym: string) => void }) {
  const [active, setActive] = useState<ScannerId>("momentum");
  const [matches, setMatches] = useState<ScanMatch[] | null>(null);
  const [source, setSource] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setMatches(null);
    fetch(`/api/scanners/${active}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { matches: ScanMatch[] } | null) => !cancelled && setMatches(d?.matches ?? []))
      .catch(() => !cancelled && setMatches([]));
    // Quote source note: scanners run on synthesized history until live creds.
    setSource("synth");
    return () => {
      cancelled = true;
    };
  }, [active]);

  const meta = SCANNERS_META.find((m) => m.id === active)!;

  return (
    <>
      <div className="card">
        <div className="card-title">Scanners — the universe, filtered by what's moving</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SCANNERS_META.map((m) => (
            <button
              key={m.id}
              onClick={() => setActive(m.id)}
              style={{
                display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start",
                padding: "10px 12px", borderRadius: 10, minWidth: 150, cursor: "pointer", textAlign: "left",
                border: `1px solid ${active === m.id ? "var(--gold-dim)" : "var(--border)"}`,
                background: active === m.id ? "rgba(212,167,60,0.1)" : "var(--panel-2)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: active === m.id ? "var(--gold)" : "var(--text)" }}>
                {m.icon} {m.label}
              </span>
              <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>{m.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card section-gap">
        <div className="card-title">{meta.label} — matches</div>
        {matches === null ? (
          <div style={{ padding: 8, color: "var(--text-3)", fontSize: 12 }}>Scanning…</div>
        ) : matches.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-3)" }}>No stocks match this scan right now.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Sector</th>
                  <th>Price</th>
                  <th>Chg</th>
                  <th>Why it matched</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.sym} style={{ cursor: "pointer" }} onClick={() => onOpen(m.sym)}>
                    <td style={{ fontWeight: 600 }}>{m.sym}</td>
                    <td>{m.sector}</td>
                    <td>₹{m.price.toFixed(2)}</td>
                    <td className={m.chgPct >= 0 ? "up" : "down"}>
                      {m.chgPct >= 0 ? "+" : ""}
                      {m.chgPct}%
                    </td>
                    <td style={{ fontFamily: "var(--font-body)", color: "var(--text-2)" }}>{m.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "var(--text-3)" }}>
          Computed server-side over a curated NSE universe, cached ~90s.
          {source === "synth" ? " Running on synthesized history until live credentials are connected — analysis only, not a signal to trade." : ""}
        </p>
      </div>
    </>
  );
}
