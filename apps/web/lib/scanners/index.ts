// Phase 12 (Gap 2) — the five launch scanners. Pure functions over OHLC series,
// unit-tested in tests/scanners.test.ts. Ship five well before expanding (per
// the phase guardrail — not chasing Sahi's 20+ count).

import { smaSeries } from "../technicals";
import type { ScanInput, ScanMatch, ScannerDef, ScannerId } from "./types";

const r1 = (x: number) => Math.round(x * 10) / 10;

function base(u: ScanInput): { price: number; chgPct: number } {
  const c = u.candles;
  const price = c[c.length - 1].close;
  const prev = c.length > 1 ? c[c.length - 2].close : price;
  return { price, chgPct: prev > 0 ? r1((price / prev - 1) * 100) : 0 };
}

// 1) Momentum — price change beyond a threshold over N sessions.
const MOMENTUM_DAYS = 5;
const MOMENTUM_PCT = 8;
function momentum(universe: ScanInput[]): ScanMatch[] {
  const out: ScanMatch[] = [];
  for (const u of universe) {
    const c = u.candles;
    if (c.length < MOMENTUM_DAYS + 1) continue;
    const now = c[c.length - 1].close;
    const then = c[c.length - 1 - MOMENTUM_DAYS].close;
    if (then <= 0) continue;
    const ret = (now / then - 1) * 100;
    if (Math.abs(ret) >= MOMENTUM_PCT) {
      const { price, chgPct } = base(u);
      out.push({
        ...pick(u), price, chgPct, metric: r1(ret),
        detail: `${ret >= 0 ? "+" : ""}${r1(ret)}% over ${MOMENTUM_DAYS} sessions`,
      });
    }
  }
  return out.sort((a, b) => Math.abs(b.metric) - Math.abs(a.metric));
}

// 2) Volume shocker — today's volume well above its own recent average.
const VOL_WINDOW = 20;
const VOL_MULT = 2;
function volume(universe: ScanInput[]): ScanMatch[] {
  const out: ScanMatch[] = [];
  for (const u of universe) {
    const c = u.candles;
    if (c.length < VOL_WINDOW + 1) continue;
    const today = c[c.length - 1].volume;
    const prior = c.slice(c.length - 1 - VOL_WINDOW, c.length - 1);
    const avg = prior.reduce((a, b) => a + b.volume, 0) / prior.length;
    if (avg <= 0) continue;
    const ratio = today / avg;
    if (ratio >= VOL_MULT) {
      const { price, chgPct } = base(u);
      out.push({ ...pick(u), price, chgPct, metric: r1(ratio), detail: `${r1(ratio)}× its ${VOL_WINDOW}-day average volume` });
    }
  }
  return out.sort((a, b) => b.metric - a.metric);
}

// 3) Gap up / down — today's open vs yesterday's close.
const GAP_PCT = 3;
function gap(universe: ScanInput[]): ScanMatch[] {
  const out: ScanMatch[] = [];
  for (const u of universe) {
    const c = u.candles;
    if (c.length < 2) continue;
    const open = c[c.length - 1].open;
    const prevClose = c[c.length - 2].close;
    if (prevClose <= 0) continue;
    const g = (open / prevClose - 1) * 100;
    if (Math.abs(g) >= GAP_PCT) {
      const { price, chgPct } = base(u);
      out.push({ ...pick(u), price, chgPct, metric: r1(g), detail: `Gapped ${g >= 0 ? "up" : "down"} ${r1(Math.abs(g))}% at the open` });
    }
  }
  return out.sort((a, b) => Math.abs(b.metric) - Math.abs(a.metric));
}

// 4) 52-week high/low proximity.
const NEAR_PCT = 2;
function highLow(universe: ScanInput[]): ScanMatch[] {
  const out: ScanMatch[] = [];
  for (const u of universe) {
    const c = u.candles.slice(-250);
    if (c.length < 30) continue;
    const hi = Math.max(...c.map((x) => x.high));
    const lo = Math.min(...c.map((x) => x.low));
    const last = c[c.length - 1].close;
    const toHigh = ((hi - last) / hi) * 100;
    const toLow = ((last - lo) / lo) * 100;
    const { price, chgPct } = base(u);
    if (toHigh <= NEAR_PCT) {
      out.push({ ...pick(u), price, chgPct, metric: r1(toHigh), detail: `Within ${r1(toHigh)}% of its 52-week high` });
    } else if (toLow <= NEAR_PCT) {
      out.push({ ...pick(u), price, chgPct, metric: -r1(toLow), detail: `Within ${r1(toLow)}% of its 52-week low` });
    }
  }
  return out.sort((a, b) => Math.abs(a.metric) - Math.abs(b.metric));
}

// 5) Golden / death cross — 50-day MA crossing the 200-day MA recently.
const CROSS_LOOKBACK = 5;
function cross(universe: ScanInput[]): ScanMatch[] {
  const out: ScanMatch[] = [];
  for (const u of universe) {
    const closes = u.candles.map((c) => c.close);
    if (closes.length < 200 + CROSS_LOOKBACK) continue;
    const s50 = smaSeries(closes, 50);
    const s200 = smaSeries(closes, 200);
    const n = closes.length;
    let crossed: "golden" | "death" | null = null;
    for (let i = n - CROSS_LOOKBACK; i < n; i++) {
      const a0 = s50[i - 1], b0 = s200[i - 1], a1 = s50[i], b1 = s200[i];
      if (a0 == null || b0 == null || a1 == null || b1 == null) continue;
      if (a0 <= b0 && a1 > b1) crossed = "golden";
      else if (a0 >= b0 && a1 < b1) crossed = "death";
    }
    if (crossed) {
      const { price, chgPct } = base(u);
      out.push({
        ...pick(u), price, chgPct, metric: crossed === "golden" ? 1 : -1,
        detail: crossed === "golden" ? "50-day MA crossed above the 200-day (golden cross)" : "50-day MA crossed below the 200-day (death cross)",
      });
    }
  }
  return out.sort((a, b) => b.metric - a.metric);
}

function pick(u: ScanInput): Pick<ScanMatch, "sym" | "name" | "sector"> {
  return { sym: u.sym, name: u.name, sector: u.sector };
}

export const SCANNERS: Record<ScannerId, ScannerDef> = {
  momentum: { id: "momentum", label: "Momentum", description: `Moved ≥ ${MOMENTUM_PCT}% over ${MOMENTUM_DAYS} sessions`, run: momentum },
  volume: { id: "volume", label: "Volume shockers", description: `Volume ≥ ${VOL_MULT}× its ${VOL_WINDOW}-day average`, run: volume },
  gap: { id: "gap", label: "Gap up / down", description: `Opened ≥ ${GAP_PCT}% away from the prior close`, run: gap },
  high_low: { id: "high_low", label: "52-week high / low", description: `Within ${NEAR_PCT}% of a 52-week extreme`, run: highLow },
  cross: { id: "cross", label: "Golden / death cross", description: "50-day MA crossed the 200-day MA recently", run: cross },
};

export function isScannerId(x: string): x is ScannerId {
  return x in SCANNERS;
}
