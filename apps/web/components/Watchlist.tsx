"use client";

// Left panel: persisted watchlist + full-market search. Typing 2+ characters
// queries /api/instruments (the whole NSE directory — equities and indices);
// picking a result adds it to the watchlist and selects it.

import { useEffect, useRef, useState } from "react";
import Sparkline from "./Sparkline";
import type { Stock } from "@/lib/types";

interface SearchResult {
  sym: string;
  name: string;
  kind: "equity" | "index";
}

interface Props {
  stocks: Stock[];
  sectors: string[];
  filter: string;
  query: string;
  currentSymbol: string;
  onFilter: (sector: string) => void;
  onQuery: (q: string) => void;
  onSelect: (sym: string) => void;
  onAdd: (sym: string) => void;
  onRemove?: (sym: string) => void;
}

export default function Watchlist({
  stocks,
  sectors,
  filter,
  query,
  currentSymbol,
  onFilter,
  onQuery,
  onSelect,
  onAdd,
  onRemove,
}: Props) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced full-market search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/instruments?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const data = res.ok ? ((await res.json()) as { results: SearchResult[] }) : { results: [] };
        setResults(data.results);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const q = query.toLowerCase();
  const inList = new Set(stocks.map((s) => s.sym));
  const rows = stocks.filter((s) => {
    const matchesSector = filter === "All" || s.sector === filter;
    const matchesQuery = s.sym.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
    return matchesSector && matchesQuery;
  });

  return (
    <div className="col">
      <div className="panel-head">
        <div className="panel-title">Screener</div>
      </div>
      <div style={{ position: "relative" }}>
        <div className="search">
          <span className="mono" style={{ color: "var(--text-3)", fontSize: 12 }}>
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search all NSE stocks & indices…"
            aria-label="Search all NSE stocks and indices"
          />
        </div>
        {query.trim().length >= 2 && (
          <div
            style={{
              position: "absolute",
              left: 14,
              right: 14,
              top: "100%",
              marginTop: -6,
              zIndex: 30,
              background: "var(--panel-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              maxHeight: 260,
              overflowY: "auto",
              boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            }}
          >
            {searching && results.length === 0 && (
              <div style={{ padding: "10px 12px", fontSize: 11, color: "var(--text-3)" }}>Searching…</div>
            )}
            {!searching && results.length === 0 && (
              <div style={{ padding: "10px 12px", fontSize: 11, color: "var(--text-3)" }}>
                No matches in the NSE directory.
              </div>
            )}
            {results.map((r) => (
              <div
                key={r.sym}
                onClick={() => onAdd(r.sym)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--border-soft)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.sym}</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-3)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.name}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {r.kind === "index" && <span className="badge neu">IDX</span>}
                  <span style={{ fontSize: 10, color: inList.has(r.sym) ? "var(--text-3)" : "var(--gold)" }}>
                    {inList.has(r.sym) ? "in list" : "+ add"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="chip-row">
        {sectors.map((s) => (
          <div key={s} className={`chip ${s === filter ? "active" : ""}`} onClick={() => onFilter(s)}>
            {s}
          </div>
        ))}
      </div>
      <div className="watchlist">
        {rows.length === 0 && <div style={{ padding: 20, color: "var(--text-3)", fontSize: 12 }}>No matches.</div>}
        {rows.map((s) => {
          const up = s.chg >= 0;
          return (
            <div
              key={s.sym}
              className={`wl-row ${s.sym === currentSymbol ? "selected" : ""}`}
              onClick={() => onSelect(s.sym)}
            >
              <div className="wl-left">
                <div className="wl-sym">{s.sym}</div>
                <div className="wl-name">{s.sector}</div>
              </div>
              <Sparkline data={s.spark} up={up} />
              <div className="wl-right">
                <div className="wl-price mono">₹{s.price.toFixed(2)}</div>
                <div className={`wl-chg mono ${up ? "up" : "down"}`}>
                  {up ? "+" : ""}
                  {s.chgPct.toFixed(2)}%
                </div>
              </div>
              {onRemove && (
                <button
                  aria-label={`Remove ${s.sym} from watchlist`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(s.sym);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-3)",
                    fontSize: 11,
                    padding: "0 0 0 6px",
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
