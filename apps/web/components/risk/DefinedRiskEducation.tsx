"use client";

// Phase 9, Feature 5 — defined-risk strategy education. Plain-language content
// from lib/education.ts, shown as expandable modules. Used both as a standalone
// section in the Risk tab and inside a modal linked contextually from the
// pre-trade gate. Informational — never a forced redirect, never framed as
// "advanced" content locked away from beginners.

import { useState } from "react";
import { EDUCATION } from "@/lib/education";

export default function DefinedRiskEducation({ initialOpen }: { initialOpen?: string }) {
  const [open, setOpen] = useState<string | null>(initialOpen ?? EDUCATION[0].slug);

  return (
    <div className="card">
      <div className="card-title">Defined-risk strategies — capped downside, by design</div>
      <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "var(--text-3)" }}>
        Ways to express a directional or income view where the worst case is known before you enter.
        Each names its own trade-off — none of these is free.
      </p>
      {EDUCATION.map((m) => {
        const isOpen = open === m.slug;
        return (
          <div
            key={m.slug}
            style={{ borderTop: "1px solid var(--border-soft)", padding: "10px 0" }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : m.slug)}
              aria-expanded={isOpen}
              style={{
                width: "100%",
                background: "none",
                border: "none",
                padding: 0,
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 10,
                color: "var(--text)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>{isOpen ? "–" : "+"}</span>
            </button>
            <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--text-3)" }}>{m.oneLiner}</p>
            {isOpen && (
              <div style={{ marginTop: 10 }}>
                {m.body.map((para, i) => (
                  <p
                    key={i}
                    style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}
                  >
                    {para}
                  </p>
                ))}
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 12,
                    color: "var(--text-2)",
                    padding: "8px 10px",
                    background: "var(--panel-2)",
                    borderRadius: 8,
                    borderLeft: "2px solid var(--gold-dim)",
                  }}
                >
                  <b style={{ color: "var(--text)" }}>The trade-off: </b>
                  {m.tradeoff}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
