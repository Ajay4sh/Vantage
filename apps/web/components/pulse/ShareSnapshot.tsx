"use client";

// Shareable mood snapshot — export-ready templates (9:16 Story, 1:1 Feed).
// Same content system as the hero, honesty guardrail intact: it renders today's
// actual mood, never a cherry-picked signal. The preview and the exported PNG
// are built from ONE self-contained SVG so what you see is what you share.

import { useState } from "react";
import { MOOD_COLOR, MOOD_WAVE, MOOD_WORD, type MarketPulse } from "@/lib/pulse";

type Fmt = "story" | "feed";

function weatherMarkup(mood: MarketPulse["mood"], color: string): string {
  if (mood === "bullish") {
    return `<circle cx="20" cy="20" r="9" fill="${color}"/><g stroke="${color}" stroke-width="2.5" stroke-linecap="round"><line x1="20" y1="2" x2="20" y2="7"/><line x1="20" y1="33" x2="20" y2="38"/><line x1="2" y1="20" x2="7" y2="20"/><line x1="33" y1="20" x2="38" y2="20"/><line x1="7" y1="7" x2="10.5" y2="10.5"/><line x1="29.5" y1="29.5" x2="33" y2="33"/><line x1="7" y1="33" x2="10.5" y2="29.5"/><line x1="29.5" y1="10.5" x2="33" y2="7"/></g>`;
  }
  if (mood === "bearish") {
    return `<ellipse cx="20" cy="16" rx="15" ry="9.5" fill="${color}"/><g stroke="${color}" stroke-width="2.5" stroke-linecap="round"><line x1="14" y1="29" x2="11" y2="37"/><line x1="21" y1="29" x2="18" y2="37"/><line x1="28" y1="29" x2="25" y2="37"/></g>`;
  }
  return `<circle cx="14" cy="15" r="7" fill="${color}"/><ellipse cx="23" cy="25" rx="13" ry="8.5" fill="${color}"/><ellipse cx="13" cy="27" rx="8" ry="6" fill="${color}"/>`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function snapshotSvg(pulse: MarketPulse, fmt: Fmt): string {
  const color = MOOD_COLOR[pulse.mood];
  const W = 1080;
  const H = fmt === "story" ? 1920 : 1080;
  const date = new Date(pulse.asOf).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const sub = pulse.headline.split(",").slice(1).join(",").trim() || "today's read";
  const title = pulse.headline.split(",")[0];
  const nifty = pulse.indices[0];
  const iconScale = fmt === "story" ? 3.75 : 2.5;
  const iconX = W / 2 - 20 * iconScale;
  const iconY = fmt === "story" ? 560 : 360;
  const cy = fmt === "story" ? 760 : 520;

  const green = "#35B08B";
  const wave = fmt === "story"
    ? `<g transform="translate(190,${cy + 120})"><path d="${MOOD_WAVE[pulse.mood]}" transform="scale(2)" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"/></g>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Space Grotesk','Inter',sans-serif">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.15"/><stop offset="0.6" stop-color="#0E1013"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="#0E1013"/>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <g transform="translate(90,${fmt === "story" ? 90 : 60})">
      <rect width="52" height="52" rx="14" fill="#D4A73C"/>
      <text x="26" y="38" font-size="30" font-weight="700" fill="#0E1013" text-anchor="middle">V</text>
      <text x="72" y="38" font-size="34" font-weight="700" fill="#ECEAE4">Vantage</text>
    </g>
    <text x="${W - 90}" y="${fmt === "story" ? 122 : 92}" font-family="'IBM Plex Mono',monospace" font-size="22" fill="#9BA0A9" text-anchor="end">${date}</text>
    <g transform="translate(${iconX},${iconY}) scale(${iconScale})">${weatherMarkup(pulse.mood, color)}</g>
    <text x="${W / 2}" y="${fmt === "story" ? 700 : 470}" font-size="30" font-weight="600" letter-spacing="2" fill="${color}" text-anchor="middle">${MOOD_WORD[pulse.mood].toUpperCase()}</text>
    ${wave}
    <text x="${W / 2}" y="${fmt === "story" ? 1060 : 640}" font-size="${fmt === "story" ? 56 : 44}" font-weight="700" fill="#ECEAE4" text-anchor="middle">${esc(title)}</text>
    <text x="${W / 2}" y="${fmt === "story" ? 1120 : 700}" font-size="26" fill="#9BA0A9" text-anchor="middle">${esc(sub)}</text>
    ${nifty ? `<text x="${W / 2}" y="${fmt === "story" ? 1260 : 780}" font-family="'IBM Plex Mono',monospace" font-size="30" fill="${nifty.changePct >= 0 ? green : "#E0616B"}" text-anchor="middle">NIFTY 50 ${nifty.value} ${nifty.changePct >= 0 ? "+" : ""}${nifty.changePct.toFixed(2)}%</text>` : ""}
    <text x="${W / 2}" y="${H - (fmt === "story" ? 110 : 70)}" font-size="22" font-weight="600" fill="#ECEAE4" text-anchor="middle">See the full picture on Vantage</text>
  </svg>`;
}

async function rasterize(svg: string, w: number, h: number): Promise<Blob> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("svg load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function ShareSnapshot({ pulse, onClose }: { pulse: MarketPulse; onClose: () => void }) {
  const [fmt, setFmt] = useState<Fmt>("story");
  const [busy, setBusy] = useState(false);
  const svg = snapshotSvg(pulse, fmt);
  const previewW = fmt === "story" ? 260 : 300;
  const previewH = fmt === "story" ? (260 * 1920) / 1080 : 300;

  async function share() {
    setBusy(true);
    try {
      const blob = await rasterize(svg, 1080, fmt === "story" ? 1920 : 1080);
      const file = new File([blob], `vantage-mood-${fmt}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: "Vantage — market mood" });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (err) {
      console.error("snapshot export failed", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div
          style={{ width: previewW, height: previewH, borderRadius: 14, overflow: "hidden", boxShadow: "0 20px 40px -20px rgba(0,0,0,0.5)" }}
          dangerouslySetInnerHTML={{ __html: svg.replace(/width="1080"/, `width="${previewW}"`).replace(/height="\d+"/, `height="${previewH}"`) }}
        />
        <div className="mode-toggle" role="group" aria-label="Format">
          <button className={fmt === "story" ? "active" : ""} onClick={() => setFmt("story")}>
            Story 9:16
          </button>
          <button className={fmt === "feed" ? "active" : ""} onClick={() => setFmt("feed")}>
            Feed 1:1
          </button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn primary" style={{ padding: "10px 18px" }} disabled={busy} onClick={share}>
            {busy ? "Preparing…" : "Share / Save image"}
          </button>
          <button className="btn" style={{ padding: "10px 18px" }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
