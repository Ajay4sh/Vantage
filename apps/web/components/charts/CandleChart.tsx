"use client";

// Phase 12 (Gap 1) — candlestick chart on lightweight-charts (TradingView's
// MIT-licensed library, not the paid widget). Candles + volume + moving-average
// overlays (20/50/200) + Bollinger Bands, pre-populated support/resistance
// lines (from the already-computed technicals), and basic drawing tools
// (horizontal lines, trendlines). Purely analytical — no order-entry UI, per
// the Phase 12 scope boundary.

import { useEffect, useRef, useState } from "react";
import type {
  IChartApi,
  IPriceLine,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";
import { bollingerBands, smaSeries } from "@/lib/technicals";
import type { Candle } from "@/lib/types";

interface Props {
  candles: Candle[];
  support: number[];
  resistance: number[];
  sym: string;
  source?: string;
}

const COLORS = {
  up: "#35B08B",
  down: "#E0616B",
  ma20: "#D4A73C",
  ma50: "#6ea8fe",
  ma200: "#b48ce0",
  bb: "#7A6FA0",
  grid: "#1E222A",
  text: "#5F6570",
  support: "#35B08B",
  resistance: "#E0616B",
  draw: "#D4A73C",
};

type DrawMode = null | "hline" | "trend";

export default function CandleChart({ candles, support, resistance, sym, source }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const maRefs = useRef<ISeriesApi<"Line">[]>([]);
  const bbRefs = useRef<ISeriesApi<"Line">[]>([]);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const userLinesRef = useRef<IPriceLine[]>([]);
  const userTrendsRef = useRef<ISeriesApi<"Line">[]>([]);
  const modeRef = useRef<DrawMode>(null);
  const pendingRef = useRef<{ time: UTCTimestamp; price: number } | null>(null);

  const [showMA, setShowMA] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [showVol, setShowVol] = useState(true);
  const [mode, setMode] = useState<DrawMode>(null);

  useEffect(() => {
    modeRef.current = mode;
    pendingRef.current = null;
  }, [mode]);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const { createChart, LineStyle, ColorType } = await import("lightweight-charts");
      if (disposed || !containerRef.current) return;

      const chart = createChart(containerRef.current, {
        layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: COLORS.text, fontSize: 10 },
        grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
        rightPriceScale: { borderColor: COLORS.grid },
        timeScale: { borderColor: COLORS.grid, timeVisible: false },
        crosshair: { mode: 0 },
        height: 340,
        width: containerRef.current.clientWidth,
      });
      chartRef.current = chart;

      // Sequential daily timestamps (synth candles carry no real dates).
      const day = 86400;
      const base = Math.floor(Date.now() / 1000) - (candles.length - 1) * day;
      const t = (i: number) => (base + i * day) as UTCTimestamp;
      const closes = candles.map((c) => c.close);

      const candleSeries = chart.addCandlestickSeries({
        upColor: COLORS.up,
        downColor: COLORS.down,
        borderVisible: false,
        wickUpColor: COLORS.up,
        wickDownColor: COLORS.down,
      });
      candleSeries.setData(candles.map((c, i) => ({ time: t(i), open: c.open, high: c.high, low: c.low, close: c.close })));
      candleRef.current = candleSeries;

      // Volume histogram on its own bottom scale.
      const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol" });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(
        candles.map((c, i) => ({
          time: t(i),
          value: c.volume,
          color: c.close >= c.open ? "rgba(53,176,139,0.4)" : "rgba(224,97,107,0.4)",
        })),
      );
      volRef.current = vol;

      // Moving averages.
      const mkLine = (color: string, width: 1 | 2 = 1) =>
        chart.addLineSeries({ color, lineWidth: width, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      const maDefs: [number, string][] = [[20, COLORS.ma20], [50, COLORS.ma50], [200, COLORS.ma200]];
      maRefs.current = maDefs.map(([period, color]) => {
        const s = mkLine(color);
        const series = smaSeries(closes, period);
        s.setData(series.flatMap((v, i) => (v == null ? [] : [{ time: t(i), value: v }])));
        return s;
      });

      // Bollinger Bands (hidden by default).
      const bb = bollingerBands(closes, 20, 2);
      const bbUpper = mkLine(COLORS.bb);
      const bbLower = mkLine(COLORS.bb);
      const bbMid = chart.addLineSeries({ color: COLORS.bb, lineWidth: 1, lineStyle: LineStyle.Dotted, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      bbUpper.setData(bb.flatMap((p, i) => (p.upper == null ? [] : [{ time: t(i), value: p.upper }])));
      bbLower.setData(bb.flatMap((p, i) => (p.lower == null ? [] : [{ time: t(i), value: p.lower }])));
      bbMid.setData(bb.flatMap((p, i) => (p.mid == null ? [] : [{ time: t(i), value: p.mid }])));
      bbRefs.current = [bbUpper, bbLower, bbMid];
      bbRefs.current.forEach((s) => s.applyOptions({ visible: false }));

      // Pre-populated support/resistance lines.
      support.forEach((p) =>
        candleSeries.createPriceLine({ price: p, color: COLORS.support, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "S" }),
      );
      resistance.forEach((p) =>
        candleSeries.createPriceLine({ price: p, color: COLORS.resistance, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "R" }),
      );

      chart.timeScale().fitContent();

      // Drawing tools.
      chart.subscribeClick((param) => {
        const m = modeRef.current;
        if (!m || !param.point || param.time == null) return;
        const price = candleSeries.coordinateToPrice(param.point.y);
        if (price == null) return;
        if (m === "hline") {
          userLinesRef.current.push(
            candleSeries.createPriceLine({ price, color: COLORS.draw, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "" }),
          );
        } else if (m === "trend") {
          const pt = { time: param.time as UTCTimestamp, price };
          if (!pendingRef.current) {
            pendingRef.current = pt;
          } else {
            const a = pendingRef.current;
            const line = mkLine(COLORS.draw, 2);
            const pts = [a, pt].sort((x, y) => (x.time as number) - (y.time as number));
            line.setData(pts.map((p) => ({ time: p.time, value: p.price })));
            userTrendsRef.current.push(line);
            pendingRef.current = null;
          }
        }
      });

      const ro = new ResizeObserver(() => {
        if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
      });
      ro.observe(containerRef.current);

      cleanup = () => {
        ro.disconnect();
        chart.remove();
        chartRef.current = null;
        candleRef.current = null;
        maRefs.current = [];
        bbRefs.current = [];
        volRef.current = null;
        userLinesRef.current = [];
        userTrendsRef.current = [];
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [candles, support, resistance]);

  // Toggle overlays without rebuilding the chart.
  useEffect(() => {
    maRefs.current.forEach((s) => s.applyOptions({ visible: showMA }));
  }, [showMA, candles]);
  useEffect(() => {
    bbRefs.current.forEach((s) => s.applyOptions({ visible: showBB }));
  }, [showBB, candles]);
  useEffect(() => {
    volRef.current?.applyOptions({ visible: showVol });
  }, [showVol, candles]);

  const clearDrawings = () => {
    userLinesRef.current.forEach((l) => candleRef.current?.removePriceLine(l));
    userLinesRef.current = [];
    userTrendsRef.current.forEach((s) => chartRef.current?.removeSeries(s));
    userTrendsRef.current = [];
    pendingRef.current = null;
    setMode(null);
  };

  const Toggle = ({ on, onClick, label, swatch }: { on: boolean; onClick: () => void; label: string; swatch?: string }) => (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 7,
        border: `1px solid ${on ? "var(--gold-dim)" : "var(--border)"}`,
        background: on ? "rgba(212,167,60,0.12)" : "var(--panel)",
        color: on ? "var(--gold)" : "var(--text-3)", fontSize: 11, cursor: "pointer",
      }}
    >
      {swatch && <span style={{ width: 8, height: 8, borderRadius: 2, background: swatch, display: "inline-block" }} />}
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <Toggle on={showMA} onClick={() => setShowMA((v) => !v)} label="MA 20/50/200" swatch={COLORS.ma20} />
        <Toggle on={showBB} onClick={() => setShowBB((v) => !v)} label="Bollinger" swatch={COLORS.bb} />
        <Toggle on={showVol} onClick={() => setShowVol((v) => !v)} label="Volume" />
        <span style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />
        <Toggle on={mode === "hline"} onClick={() => setMode(mode === "hline" ? null : "hline")} label="＋ H-line" />
        <Toggle on={mode === "trend"} onClick={() => setMode(mode === "trend" ? null : "trend")} label="╱ Trendline" />
        <button onClick={clearDrawings} style={{ padding: "4px 9px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--text-3)", fontSize: 11, cursor: "pointer" }}>
          Clear
        </button>
      </div>
      {mode && (
        <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--gold)" }}>
          {mode === "hline" ? "Click on the chart to drop a horizontal line." : "Click two points to draw a trendline."}
        </p>
      )}
      <div ref={containerRef} style={{ width: "100%", height: 340 }} role="img" aria-label={`Candlestick chart of ${sym}`} />
      <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "var(--text-3)" }}>
        Candles · MA 20/50/200 · Bollinger(20,2) · volume. Dashed lines are computed support (S) / resistance (R).
        {source && source !== "live" ? " Synthesized history (no live feed) — analysis only." : ""}
      </p>
    </div>
  );
}
