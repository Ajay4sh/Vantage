// Phase 12 (Gap 2) — scanner types. Each scanner is a pure function over the
// universe's OHLC series; the route builds the universe and caches results.

import type { Candle } from "../types";

export type ScannerId = "momentum" | "volume" | "gap" | "high_low" | "cross";

export interface ScanInput {
  sym: string;
  name: string;
  sector: string;
  candles: Candle[]; // oldest → newest, ~220 daily bars
}

export interface ScanMatch {
  sym: string;
  name: string;
  sector: string;
  price: number;
  chgPct: number; // latest session change
  metric: number; // the scanner's headline number, for sorting
  detail: string; // plain-language reason this matched
}

export interface ScannerDef {
  id: ScannerId;
  label: string;
  description: string;
  run: (universe: ScanInput[]) => ScanMatch[];
}
