"use client";

// Diverging open-interest bars — calls above the axis, puts below — same
// config as the demo's renderOptions().

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

interface Props {
  strikes: number[];
  callOI: number[];
  putOI: number[];
  sym: string;
}

export default function OIChart({ strikes, callOI, putOI, sym }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<"bar"> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    chartRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels: [],
        datasets: [
          { label: "Call OI", data: [], backgroundColor: "#35B08B", borderRadius: 4 },
          { label: "Put OI", data: [], backgroundColor: "#E0616B", borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${Math.abs(ctx.raw as number).toLocaleString()}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#5F6570", font: { size: 10 } } },
          y: {
            grid: { color: "#1E222A" },
            ticks: {
              color: "#5F6570",
              font: { size: 9 },
              callback: (v) => {
                const n = Math.abs(Number(v));
                return n >= 1000 ? n / 1000 + "k" : n;
              },
            },
          },
        },
      },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.data.labels = strikes.map((v) => `₹${v}`);
    chart.data.datasets[0].data = callOI;
    chart.data.datasets[1].data = putOI.map((v) => -v);
    chart.update("none");
  }, [strikes, callOI, putOI]);

  return (
    <div style={{ position: "relative", height: 240 }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Diverging bar chart of call and put open interest by strike price for ${sym}`}
      />
    </div>
  );
}
