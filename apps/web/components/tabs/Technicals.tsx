"use client";

import { useEffect, useState } from "react";
import CandleChart from "../charts/CandleChart";
import MetricTooltip from "../MetricTooltip";
import type { Candle, Stock } from "@/lib/types";

export default function Technicals({ stock }: { stock: Stock }) {
  const t = stock.technicals;
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [source, setSource] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setCandles(null);
    fetch(`/api/candles?symbol=${encodeURIComponent(stock.sym)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { candles: Candle[]; source: string } | null) => {
        if (!cancelled && d) {
          setCandles(d.candles);
          setSource(d.source);
        }
      })
      .catch(() => !cancelled && setCandles([]));
    return () => {
      cancelled = true;
    };
  }, [stock.sym]);

  return (
    <>
      <div className="card">
        <div className="card-title">Price action — daily candles</div>
        {candles === null ? (
          <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: 12 }}>
            Loading chart…
          </div>
        ) : (
          <CandleChart
            candles={candles}
            support={t.support}
            resistance={t.resistance}
            sym={stock.sym}
            source={source}
          />
        )}
      </div>
      <div className="section-gap grid-3">
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="trend">Trend</MetricTooltip>
          </div>
          <div className="metric-val" style={{ fontSize: 13 }}>
            {t.trend}
          </div>
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="rsi">RSI (14)</MetricTooltip>
          </div>
          <div className="metric-val">{t.rsi}</div>
        </div>
        <div className="card">
          <div className="metric-label">
            <MetricTooltip term="macd">MACD</MetricTooltip>
          </div>
          <div className="metric-val" style={{ fontSize: 13 }}>
            {t.macd}
          </div>
        </div>
      </div>
      <div className="section-gap grid-2">
        <div className="card">
          <div className="card-title">Support levels</div>
          {t.support.map((v) => (
            <div className="driver-row" key={v}>
              <span className="driver-name">Zone</span>
              <span className="mono up">₹{v}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title">Resistance levels</div>
          {t.resistance.map((v) => (
            <div className="driver-row" key={v}>
              <span className="driver-name">Zone</span>
              <span className="mono down">₹{v}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
