"use client";

// Chart.js line chart, same config as the demo's renderTechnicals(). Created
// once and updated in place so live ticks don't flicker the canvas.

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export default function PriceChart({ history, sym }: { history: number[]; sym: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    chartRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            borderColor: "#D4A73C",
            backgroundColor: "rgba(212,167,60,0.08)",
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.25,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#5F6570", font: { size: 9 } } },
          y: { grid: { color: "#1E222A" }, ticks: { color: "#5F6570", font: { size: 9 } } },
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
    chart.data.labels = history.map((_, i) => `D${i + 1}`);
    chart.data.datasets[0].data = history;
    chart.update("none");
  }, [history]);

  return (
    <div style={{ position: "relative", height: 220 }}>
      <canvas ref={canvasRef} role="img" aria-label={`Line chart of ${sym} price over the last 20 sessions`} />
    </div>
  );
}
