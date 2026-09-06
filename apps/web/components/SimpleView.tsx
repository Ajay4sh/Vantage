"use client";

// Simple mode: a reduced, jargon-light view of one stock — price, a
// one-sentence plain-language take, the composite band, and a link into the
// full Pro terminal. The SEBI disclaimer stays visible here too (the prompt
// is explicit: simplification must not drop the compliance language).

import { useApp } from "./AppProvider";
import { plainTake } from "@/lib/plain-take";
import { useT } from "@/lib/i18n/react";
import type { Stock } from "@/lib/types";

const BAND_COLOR = {
  constructive: "var(--pos)",
  cautious: "var(--neg)",
  mixed: "var(--text-2)",
} as const;

export default function SimpleView({ stock }: { stock: Stock }) {
  const { setMode } = useApp();
  const t = useT();
  const take = plainTake(stock);
  const up = stock.chg >= 0;

  return (
    <div className="col" style={{ padding: "0 0 30px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "28px 22px", width: "100%" }}>
        <div className="sh-top" style={{ marginBottom: 4 }}>
          <div className="sh-sym">{stock.sym}</div>
          <div className="sh-name">{stock.name}</div>
        </div>

        <div className="sh-price-row" style={{ marginBottom: 18 }}>
          <div className="sh-price mono">₹{stock.price.toFixed(2)}</div>
          <div className="sh-chg mono">
            <span className={up ? "up" : "down"}>
              {up ? "+" : ""}
              {stock.chg.toFixed(2)} ({up ? "+" : ""}
              {stock.chgPct.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: "18px 20px" }}>
          <div className="card-title">{t("simple.take")}</div>
          <p style={{ margin: "0 0 4px", fontSize: 15, lineHeight: 1.55, color: "var(--text)" }}>
            {take.headline}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: BAND_COLOR[take.band],
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--text-2)", textTransform: "capitalize" }}>
              {take.band} · {t("simple.conviction")} {take.score > 0 ? "+" : ""}
              {take.score}
            </span>
          </div>
        </div>

        <button
          className="btn primary"
          style={{ width: "100%", marginTop: 16, padding: "12px" }}
          onClick={() => setMode("pro")}
        >
          {t("simple.seeFull")}
        </button>

        <div className="disclaimer" style={{ margin: "18px 0 0" }}>
          {t("disclaimer.body")}
        </div>
      </div>
    </div>
  );
}
