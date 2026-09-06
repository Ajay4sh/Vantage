import type { Stock } from "@/lib/types";

export default function StockHeader({ stock }: { stock: Stock }) {
  const up = stock.chg >= 0;
  return (
    <div className="stock-header">
      <div className="sh-top">
        <div className="sh-sym">{stock.sym}</div>
        <div className="sh-name">{stock.name}</div>
      </div>
      <div className="sh-price-row">
        <div className="sh-price mono">₹{stock.price.toFixed(2)}</div>
        <div className="sh-chg mono">
          <span className={up ? "up" : "down"}>
            {up ? "+" : ""}
            {stock.chg.toFixed(2)} ({up ? "+" : ""}
            {stock.chgPct.toFixed(2)}%)
          </span>
        </div>
      </div>
      <div className="sh-meta">
        {stock.kind !== "index" && (
          <>
            <div>
              Mkt cap <b>{stock.marketCap}</b>
            </div>
            <div>
              P/E <b>{stock.fundamentals.pe ?? "—"}</b>
            </div>
          </>
        )}
        <div>
          52W range <b>{stock.week52}</b>
        </div>
        <div>
          {stock.kind === "index" ? "Type" : "Sector"} <b>{stock.kind === "index" ? "NSE Index" : stock.sector}</b>
        </div>
      </div>
    </div>
  );
}
