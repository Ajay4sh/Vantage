"use client";

import PriceChart from "../charts/PriceChart";
import MetricTooltip from "../MetricTooltip";
import type { Stock } from "@/lib/types";

export default function Technicals({ stock }: { stock: Stock }) {
  const t = stock.technicals;
  return (
    <>
      <div className="card">
        <div className="card-title">Price action (20 sessions)</div>
        <PriceChart history={t.priceHistory} sym={stock.sym} />
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
