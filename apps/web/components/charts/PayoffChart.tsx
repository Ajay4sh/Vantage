"use client";

// Phase 12 (Gap 3) — options strategy payoff diagram. Reuses lightweight-charts
// (the Gap 1 library, not a second charting approach): a baseline series around
// P&L = 0 so profit renders green and loss red. The x-axis is the underlying
// price at expiry (mapped onto the library's time axis and relabelled).

import { useEffect, useRef } from "react";
import type { IChartApi, UTCTimestamp } from "lightweight-charts";
import type { PayoffPoint } from "@/lib/options/strategyBuilder";

export default function PayoffChart({
  curve,
  breakevens,
  spot,
}: {
  curve: PayoffPoint[];
  breakevens: number[];
  spot: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || curve.length === 0) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const { createChart, ColorType, LineStyle } = await import("lightweight-charts");
      if (disposed || !containerRef.current) return;

      const day = 86400;
      const base = Math.floor(Date.now() / 1000) - (curve.length - 1) * day;
      const timeToPrice = (time: number) => {
        const i = Math.round((time - base) / day);
        return curve[Math.max(0, Math.min(curve.length - 1, i))]?.s ?? 0;
      };

      const chart = createChart(containerRef.current, {
        layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#5F6570", fontSize: 10 },
        grid: { vertLines: { color: "#1E222A" }, horzLines: { color: "#1E222A" } },
        rightPriceScale: { borderColor: "#1E222A" },
        timeScale: {
          borderColor: "#1E222A",
          tickMarkFormatter: (time: number) => "₹" + Math.round(timeToPrice(time)).toLocaleString("en-IN"),
        },
        localization: { timeFormatter: (time: number) => "Underlying ₹" + Math.round(timeToPrice(time)).toLocaleString("en-IN") },
        crosshair: { mode: 0 },
        height: 300,
        width: containerRef.current.clientWidth,
      });
      chartRef.current = chart;

      const series = chart.addBaselineSeries({
        baseValue: { type: "price", price: 0 },
        topLineColor: "#35B08B",
        topFillColor1: "rgba(53,176,139,0.28)",
        topFillColor2: "rgba(53,176,139,0.04)",
        bottomLineColor: "#E0616B",
        bottomFillColor1: "rgba(224,97,107,0.04)",
        bottomFillColor2: "rgba(224,97,107,0.28)",
        lineWidth: 2,
        priceFormat: { type: "price", precision: 0, minMove: 1 },
      });
      series.setData(curve.map((p, i) => ({ time: (base + i * day) as UTCTimestamp, value: p.pnl })));
      series.createPriceLine({ price: 0, color: "#5F6570", lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: false, title: "" });

      // Markers: spot + breakevens along the curve.
      const nearestIdx = (s: number) => {
        let best = 0;
        for (let i = 1; i < curve.length; i++) if (Math.abs(curve[i].s - s) < Math.abs(curve[best].s - s)) best = i;
        return best;
      };
      const markers = [
        { time: (base + nearestIdx(spot) * day) as UTCTimestamp, position: "belowBar" as const, color: "#D4A73C", shape: "arrowUp" as const, text: "spot" },
        ...breakevens.map((be) => ({
          time: (base + nearestIdx(be) * day) as UTCTimestamp,
          position: "aboveBar" as const,
          color: "#9ba0a9",
          shape: "circle" as const,
          text: "BE ₹" + Math.round(be),
        })),
      ].sort((a, b) => (a.time as number) - (b.time as number));
      series.setMarkers(markers);

      chart.timeScale().fitContent();

      const ro = new ResizeObserver(() => {
        if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
      });
      ro.observe(containerRef.current);

      cleanup = () => {
        ro.disconnect();
        chart.remove();
        chartRef.current = null;
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [curve, breakevens, spot]);

  return <div ref={containerRef} style={{ width: "100%", height: 300 }} role="img" aria-label="Strategy payoff diagram" />;
}
