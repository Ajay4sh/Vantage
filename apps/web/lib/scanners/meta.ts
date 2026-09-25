// Phase 12 (Gap 2) — client-safe scanner metadata (no server/data imports), so
// the Scanners screen can list the types without pulling the universe builder
// into the client bundle.

import type { ScannerId } from "./types";

export const SCANNERS_META: { id: ScannerId; label: string; description: string; icon: string }[] = [
  { id: "momentum", label: "Momentum", description: "Big movers over the last 5 sessions", icon: "🚀" },
  { id: "volume", label: "Volume shockers", description: "Volume far above its own average", icon: "📊" },
  { id: "gap", label: "Gap up / down", description: "Opened well away from the prior close", icon: "↔" },
  { id: "high_low", label: "52-week high / low", description: "Near a 52-week extreme", icon: "🎯" },
  { id: "cross", label: "Golden / death cross", description: "50-day MA crossed the 200-day MA", icon: "✕" },
];
