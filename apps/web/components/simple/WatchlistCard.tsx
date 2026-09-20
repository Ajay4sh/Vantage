"use client";

// Concept B — glass watchlist card. Gradient icon badge (first two letters of
// the ticker), symbol + sector, price + change on the right. A visual wrapper
// around existing Stock data — no new data source.

import type { Stock } from "@/lib/types";

export default function WatchlistCard({ stock, onClick }: { stock: Stock; onClick?: () => void }) {
  const up = stock.chg >= 0;
  return (
    <button className="cb-glass cb-wcard" onClick={onClick}>
      <span className="cb-badge" aria-hidden="true">
        {stock.sym.slice(0, 2)}
      </span>
      <span className="cb-wcard-mid">
        <span className="cb-wcard-sym" style={{ display: "block" }}>
          {stock.sym}
        </span>
        <span className="cb-wcard-sector">{stock.sector}</span>
      </span>
      <span className="cb-wcard-right">
        <span className="cb-wcard-price cb-data" style={{ display: "block" }}>
          ₹{stock.price.toFixed(2)}
        </span>
        <span className={`cb-wcard-chg cb-data ${up ? "cb-pos" : "cb-neg"}`}>
          {up ? "+" : ""}
          {stock.chgPct.toFixed(2)}%
        </span>
      </span>
    </button>
  );
}
