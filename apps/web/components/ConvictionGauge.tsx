"use client";

import GaugeChart from "./charts/GaugeChart";
import MetricTooltip from "./MetricTooltip";
import { computeConviction } from "@/lib/conviction";
import type { Stock } from "@/lib/types";

export default function ConvictionGauge({ stock }: { stock: Stock }) {
  const conv = computeConviction(stock);
  const clamped = Math.max(-100, Math.min(100, conv.score));
  const pct = (clamped + 100) / 200; // 0..1

  const scoreClass = clamped > 10 ? "up" : clamped < -10 ? "down" : "";
  const label =
    clamped > 20 ? "Constructive composite" : clamped < -20 ? "Cautious composite" : "Mixed / neutral composite";

  return (
    <>
      <div className="panel-head">
        <div className="panel-title">
          <MetricTooltip term="conviction">Conviction score</MetricTooltip>
        </div>
      </div>
      <div className="gauge-wrap">
        <GaugeChart pct={pct} positive={clamped >= 0} />
        <div className={`gauge-score ${scoreClass}`}>
          {clamped > 0 ? "+" : ""}
          {clamped}
        </div>
        <div className="gauge-label">{label}</div>
      </div>
      <div style={{ padding: "4px 16px 6px" }}>
        {conv.drivers.map((d) => {
          const color = d.score > 5 ? "#35B08B" : d.score < -5 ? "#E0616B" : "#5F6570";
          return (
            <div className="driver-row" key={d.name}>
              <span className="driver-name">
                <span className="dot" style={{ background: color }} />
                {d.name}
              </span>
              <span className="mono">
                {d.score > 0 ? "+" : ""}
                {d.score}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
