"use client";

// Pro redesign — order ticket. The "Trade" (equity) and "Review order"
// (strategy) flow both land here: review the order and its worst case, then
// place. Placement is PAPER unless the owner has explicitly enabled live
// execution with their own broker token (the banner says which). Nothing places
// an order without this explicit confirm step.

import { useEffect, useState } from "react";
import RiskDisclaimer from "../risk/RiskDisclaimer";

const inr = (n: number) => (n < 0 ? "−₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN");

interface Props {
  kind: "equity" | "strategy";
  symbol: string;
  spot: number;
  defaultSide?: "buy" | "sell";
  summary?: string;
  maxLoss?: number | null;
  maxLossUnbounded?: boolean;
  onClose: () => void;
}

interface Confirmation {
  id: string;
  status: "paper_filled" | "live_submitted" | "rejected";
  mode: "paper" | "live";
  message: string;
}

export default function OrderTicket({ kind, symbol, spot, defaultSide = "buy", summary, maxLoss, maxLossUnbounded, onClose }: Props) {
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [side, setSide] = useState<"buy" | "sell">(defaultSide);
  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [price, setPrice] = useState(spot);
  const [product, setProduct] = useState("CNC");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Confirmation | null>(null);

  useEffect(() => {
    fetch("/api/orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { mode: "paper" | "live" }) => setMode(d.mode))
      .catch(() => {});
  }, []);

  const notional = kind === "equity" ? qty * (orderType === "limit" ? price : spot) : 0;

  async function place() {
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "equity"
            ? { symbol, side, qty, orderType, price: orderType === "limit" ? price : undefined, product, kind: "equity" }
            : { symbol, side, qty: 1, orderType: "market", kind: "strategy", summary },
        ),
      });
      const data = (await res.json()) as { confirmation: Confirmation };
      setDone(data.confirmation);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="order-backdrop" onClick={onClose}>
      <div className="card" style={{ width: 460, maxWidth: "100%", padding: 22 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Order ticket">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div className="display" style={{ fontSize: 18, fontWeight: 700 }}>
            {kind === "equity" ? "Trade" : "Review order"} · {symbol}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: 16 }}>✕</button>
        </div>

        {/* Mode banner */}
        <div className="disclaimer" style={{ margin: "0 0 14px", background: mode === "live" ? "var(--neg-bg)" : "var(--panel-2)", borderColor: mode === "live" ? "#3a1d22" : "var(--border)", color: mode === "live" ? "#e6b4b9" : "var(--text-2)" }}>
          {mode === "live"
            ? "LIVE execution is enabled — this will place a real order with your broker."
            : "Paper mode — no live broker connected. This records the order for your journal, it is not sent to any exchange."}
        </div>

        {done ? (
          <>
            <div className="card" style={{ background: done.status === "rejected" ? "var(--neg-bg)" : "var(--pos-bg)", border: `1px solid ${done.status === "rejected" ? "#3a1d22" : "#1c3a30"}` }}>
              <div className="metric-val" style={{ fontSize: 16, color: done.status === "rejected" ? "var(--neg)" : "var(--pos)" }}>
                {done.status === "rejected" ? "Rejected" : done.mode === "paper" ? "Paper order recorded" : "Order submitted"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>{done.message}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 6, fontFamily: "var(--font-mono)" }}>ref {done.id}</div>
            </div>
            <button className="pro-btn" style={{ width: "100%", marginTop: 14 }} onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            {kind === "equity" ? (
              <>
                <div className="seg" style={{ marginBottom: 12 }}>
                  <button className={side === "buy" ? "on-buy" : ""} onClick={() => setSide("buy")}>BUY</button>
                  <button className={side === "sell" ? "on-sell" : ""} onClick={() => setSide("sell")}>SELL</button>
                </div>
                <div className="grid-2" style={{ marginBottom: 12 }}>
                  <div>
                    <label className="metric-label">Quantity (shares)</label>
                    <input value={qty} onChange={(e) => setQty(Math.max(1, Math.round(Number(e.target.value.replace(/[^0-9]/g, "")) || 1)))} className="cb-search" style={{ marginTop: 6, width: "100%", background: "var(--panel)", borderColor: "var(--border)", color: "var(--text)" }} inputMode="numeric" />
                  </div>
                  <div>
                    <label className="metric-label">Product</label>
                    <select value={product} onChange={(e) => setProduct(e.target.value)} className="cb-search" style={{ marginTop: 6, width: "100%", background: "var(--panel)", borderColor: "var(--border)", color: "var(--text)" }}>
                      <option value="CNC">CNC (delivery)</option>
                      <option value="MIS">MIS (intraday)</option>
                    </select>
                  </div>
                </div>
                <div className="grid-2" style={{ marginBottom: 12 }}>
                  <div>
                    <label className="metric-label">Order type</label>
                    <div className="seg" style={{ marginTop: 6 }}>
                      <button className={orderType === "market" ? "on" : ""} onClick={() => setOrderType("market")}>MKT</button>
                      <button className={orderType === "limit" ? "on" : ""} onClick={() => setOrderType("limit")}>LIMIT</button>
                    </div>
                  </div>
                  <div>
                    <label className="metric-label">Price</label>
                    <input value={orderType === "limit" ? price : Math.round(spot)} disabled={orderType === "market"} onChange={(e) => setPrice(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)} className="cb-search" style={{ marginTop: 6, width: "100%", background: "var(--panel)", borderColor: "var(--border)", color: orderType === "market" ? "var(--text-3)" : "var(--text)" }} inputMode="decimal" />
                  </div>
                </div>
                <div className="card" style={{ background: "var(--panel-2)", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span style={{ color: "var(--text-2)" }}>Order value</span>
                    <b className="mono">{inr(notional)}</b>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
                    {side === "buy"
                      ? "A long equity position can lose its full value if the stock falls to zero — size it accordingly."
                      : "A short position's loss is not capped if the stock rises. Know your exit."}
                  </div>
                </div>
              </>
            ) : (
              <div className="card" style={{ background: "var(--panel-2)", marginBottom: 12 }}>
                <div className="metric-label">Strategy</div>
                <div style={{ fontSize: 12.5, color: "var(--text)", margin: "4px 0 10px" }}>{summary}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#d89aa0" }}>Maximum loss</span>
                  <b className="mono" style={{ color: "var(--neg)" }}>{maxLossUnbounded ? "Unbounded" : inr(maxLoss ?? 0)}</b>
                </div>
                {maxLossUnbounded && (
                  <div style={{ fontSize: 11, color: "var(--neg)", marginTop: 6 }}>Undefined-risk structure — losses are not capped. Proceed only if you accept that.</div>
                )}
              </div>
            )}

            <RiskDisclaimer>
              Review the worst case above before placing. Not investment advice. In paper mode nothing reaches an exchange; live mode uses your own broker and is your responsibility.
            </RiskDisclaimer>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="pro-btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
              <button className="pro-btn gold" style={{ flex: 1 }} disabled={busy} onClick={place}>
                {busy ? "Placing…" : mode === "live" ? "Place order" : "Place paper order"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
