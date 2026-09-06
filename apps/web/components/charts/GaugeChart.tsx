"use client";

// Half-doughnut conviction gauge, same config as the demo's renderConviction().

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export default function GaugeChart({ pct, positive }: { pct: number; positive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<"doughnut"> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    chartRef.current = new Chart(canvas, {
      type: "doughnut",
      data: {
        datasets: [
          {
            data: [0, 1],
            backgroundColor: ["#35B08B", "#1B1F26"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        circumference: 180,
        rotation: 270,
        cutout: "75%",
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
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
    chart.data.datasets[0].data = [pct, 1 - pct];
    chart.data.datasets[0].backgroundColor = [positive ? "#35B08B" : "#E0616B", "#1B1F26"];
    chart.update("none");
  }, [pct, positive]);

  return <canvas ref={canvasRef} width={160} height={90} />;
}
