"use client";

// Phase 12 / Pro redesign (Gap 1) — candlestick chart on lightweight-charts
// (TradingView MIT lib, not the paid widget), styled to the Pro PDF: timeframe
// pills, overlay pills with colour swatches, an OHLC readout, and a drawing-
// tools dropdown. Candles + MA(20/50/200) + Bollinger(20,2) + volume, with
// pre-drawn support/resistance and user trendlines/H-lines. Analytical only —
// no order entry attached to the chart.

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, IPriceLine, ISeriesApi, UTCTimestamp } from "lightweight-charts";
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
  up: "#35B08B", down: "#E0616B", ma20: "#D4A73C", ma50: "#6ea8fe", ma200: "#b48ce0",
  bb: "#7A6FA0", grid: "#1E222A", text: "#5F6570", support: "#35B08B", resistance: "#E0616B", draw: "#D4A73C",
};

type DrawMode = null | "hline" | "trend";
type TF = "1D" | "1W" | "1M" | "3M" | "1Y";
const TF_WIN: Record<TF, number> = { "1D": 3, "1W": 8, "1M": 22, "3M": 66, "1Y": 250 };

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

  const [tf, setTf] = useState<TF>("3M");
  const [showMA, setShowMA] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [showVol, setShowVol] = useState(true);
  const [showSR, setShowSR] = useState(true);
  const [mode, setMode] = useState<DrawMode>(null);
  const [ddOpen, setDdOpen] = useState(false);

  const start = Math.max(0, candles.length - TF_WIN[tf]);
  const view = useMemo(() => candles.slice(start), [candles, start]);

  // OHLC readout (last visible bar) — MA/BB computed on full history.
  const readout = useMemo(() => {
    if (candles.length === 0) return null;
    const closes = candles.map((c) => c.close);
    const last = candles[candles.length - 1];
    const ma = (n: number) => smaSeries(closes, n)[closes.length - 1];
    const bb = bollingerBands(closes, 20, 2)[closes.length - 1];
    return { last, ma20: ma(20), ma50: ma(50), ma200: ma(200), bb };
  }, [candles]);

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
        height: 380,
        width: containerRef.current.clientWidth,
      });
      chartRef.current = chart;

      const day = 86400;
      const base = Math.floor(Date.now() / 1000) - (candles.length - 1) * day;
      const t = (i: number) => (base + i * day) as UTCTimestamp; // absolute index across full history
      const fullCloses = candles.map((c) => c.close);
      const sliceSeries = (s: (number | null)[]) => s.flatMap((v, i) => (i < start || v == null ? [] : [{ time: t(i), value: v }]));

      const candleSeries = chart.addCandlestickSeries({ upColor: COLORS.up, downColor: COLORS.down, borderVisible: false, wickUpColor: COLORS.up, wickDownColor: COLORS.down });
      candleSeries.setData(candles.slice(start).map((c, i) => ({ time: t(start + i), open: c.open, high: c.high, low: c.low, close: c.close })));
      candleRef.current = candleSeries;

      const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol" });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
      vol.setData(candles.slice(start).map((c, i) => ({ time: t(start + i), value: c.volume, color: c.close >= c.open ? "rgba(53,176,139,0.4)" : "rgba(224,97,107,0.4)" })));
      volRef.current = vol;
      vol.applyOptions({ visible: showVol });

      const mkLine = (color: string, width: 1 | 2 = 1, style?: number) =>
        chart.addLineSeries({ color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      maRefs.current = ([[20, COLORS.ma20], [50, COLORS.ma50], [200, COLORS.ma200]] as [number, string][]).map(([period, color]) => {
        const s = mkLine(color);
        s.setData(sliceSeries(smaSeries(fullCloses, period)));
        s.applyOptions({ visible: showMA });
        return s;
      });

      const bb = bollingerBands(fullCloses, 20, 2);
      const bbUpper = mkLine(COLORS.bb), bbLower = mkLine(COLORS.bb), bbMid = mkLine(COLORS.bb, 1, LineStyle.Dotted);
      bbUpper.setData(sliceSeries(bb.map((p) => p.upper)));
      bbLower.setData(sliceSeries(bb.map((p) => p.lower)));
      bbMid.setData(sliceSeries(bb.map((p) => p.mid)));
      bbRefs.current = [bbUpper, bbLower, bbMid];
      bbRefs.current.forEach((s) => s.applyOptions({ visible: showBB }));

      if (showSR) {
        support.forEach((pr) => candleSeries.createPriceLine({ price: pr, color: COLORS.support, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "S" }));
        resistance.forEach((pr) => candleSeries.createPriceLine({ price: pr, color: COLORS.resistance, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "R" }));
      }

      chart.timeScale().fitContent();

      chart.subscribeClick((param) => {
        const m = modeRef.current;
        if (!m || !param.point || param.time == null) return;
        const price = candleSeries.coordinateToPrice(param.point.y);
        if (price == null) return;
        if (m === "hline") {
          userLinesRef.current.push(candleSeries.createPriceLine({ price, color: COLORS.draw, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "" }));
        } else if (m === "trend") {
          const pt = { time: param.time as UTCTimestamp, price };
          if (!pendingRef.current) pendingRef.current = pt;
          else {
            const line = mkLine(COLORS.draw, 2);
            const pts = [pendingRef.current, pt].sort((x, y) => (x.time as number) - (y.time as number));
            line.setData(pts.map((pp) => ({ time: pp.time, value: pp.price })));
            userTrendsRef.current.push(line);
            pendingRef.current = null;
          }
        }
      });

      const ro = new ResizeObserver(() => { if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth }); });
      ro.observe(containerRef.current);
      cleanup = () => { ro.disconnect(); chart.remove(); chartRef.current = null; candleRef.current = null; maRefs.current = []; bbRefs.current = []; volRef.current = null; userLinesRef.current = []; userTrendsRef.current = []; };
    })();

    return () => { disposed = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, support, resistance, tf, showSR]);

  useEffect(() => { maRefs.current.forEach((s) => s.applyOptions({ visible: showMA })); }, [showMA]);
  useEffect(() => { bbRefs.current.forEach((s) => s.applyOptions({ visible: showBB })); }, [showBB]);
  useEffect(() => { volRef.current?.applyOptions({ visible: showVol }); }, [showVol]);

  const clearDrawings = () => {
    userLinesRef.current.forEach((l) => candleRef.current?.removePriceLine(l));
    userLinesRef.current = [];
    userTrendsRef.current.forEach((s) => chartRef.current?.removeSeries(s));
    userTrendsRef.current = [];
    pendingRef.current = null;
    setMode(null);
  };

  const Pill = ({ on, onClick, label, sw }: { on: boolean; onClick: () => void; label: string; sw?: string }) => (
    <button className={`ch-pill ${on ? "on" : ""}`} onClick={onClick}>
      {sw && <span className="ch-sw" style={{ background: sw }} />}{label}
    </button>
  );
  const fmtVol = (v: number) => (v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : String(v));

  return (
    <div>
      <div className="ch-toolbar">
        <div className="ch-seg">
          {(["1D", "1W", "1M", "3M", "1Y"] as TF[]).map((x) => (
            <button key={x} className={tf === x ? "active" : ""} onClick={() => setTf(x)}>{x}</button>
          ))}
        </div>
        <div className="ch-overlays">
          <span className="ch-eyebrow" style={{ marginRight: 4 }}>Overlays</span>
          <Pill on={showMA} onClick={() => setShowMA((v) => !v)} label="MA 20/50/200" sw={COLORS.ma20} />
          <Pill on={showBB} onClick={() => setShowBB((v) => !v)} label="Bollinger" sw={COLORS.bb} />
          <Pill on={showVol} onClick={() => setShowVol((v) => !v)} label="Volume" />
          <Pill on={showSR} onClick={() => setShowSR((v) => !v)} label="S/R" sw={COLORS.support} />
        </div>
        <div className="ch-dd">
          <button className="pro-btn" onClick={() => setDdOpen((v) => !v)}>✎ Drawing tools ▾</button>
          {ddOpen && (
            <div className="ch-dd-menu">
              <Pill on={mode === "trend"} onClick={() => setMode(mode === "trend" ? null : "trend")} label="╱ Trendline" />
              <Pill on={mode === "hline"} onClick={() => setMode(mode === "hline" ? null : "hline")} label="— Horizontal line" />
              <p style={{ margin: "10px 0 0", fontSize: 10.5, color: "var(--text-3)" }}>Tap two points on the chart to draw a trendline; one point for a horizontal line.</p>
              <button className="scan-viewall" style={{ marginTop: 10 }} onClick={clearDrawings}>Clear all drawings</button>
            </div>
          )}
        </div>
      </div>

      {readout && (
        <div className="ch-ohlc">
          <span>{sym} · {tf} · Daily</span>
          <span>O <b>{readout.last.open}</b> H <b>{readout.last.high}</b> L <b>{readout.last.low}</b> C <b>{readout.last.close}</b></span>
          <span>Vol <b>{fmtVol(readout.last.volume)}</b></span>
          {showMA && readout.ma50 != null && <span style={{ color: COLORS.ma50 }}>MA50 {readout.ma50}</span>}
          {showMA && readout.ma200 != null && <span style={{ color: COLORS.ma200 }}>MA200 {readout.ma200}</span>}
          {showBB && readout.bb.upper != null && <span style={{ color: COLORS.bb }}>BB {readout.bb.upper} / {readout.bb.lower}</span>}
        </div>
      )}

      {mode && <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--gold)" }}>{mode === "hline" ? "Click the chart to drop a horizontal line." : "Click two points to draw a trendline."}</p>}

      <div ref={containerRef} style={{ width: "100%", height: 380 }} role="img" aria-label={`Candlestick chart of ${sym}`} />

      <div className="ch-foot">
        {support[0] != null && <span>--- Support <b className="mono" style={{ color: "var(--pos)" }}>₹{support[0]}</b></span>}
        {resistance[0] != null && <span>--- Resistance <b className="mono" style={{ color: "var(--neg)" }}>₹{resistance[0]}</b></span>}
        <span style={{ marginLeft: "auto", color: "var(--text-3)" }}>
          Levels auto-drawn from pivots.{source && source !== "live" ? " Synthesized history — analysis only." : ""}
        </span>
      </div>
    </div>
  );
}
