// Phase 11 — Portfolio Risk Radar. Aggregate-level risk that looks fine
// position-by-position but isn't in aggregate: concentration, correlated bets,
// combined F&O max-loss vs capital, clustered expiry exposure, and a
// portfolio-wide implied move.
//
// Extends the Phase 9 single-trade engine (./core) to the whole book. Pure and
// unit-tested (tests/portfolio.test.ts). Framing rule carries over from Phase 9:
// these are risk figures for reflection, never trade advice, and precision is
// never overstated — the implied-move aggregate in particular is an explicit
// lower bound (see computePortfolioImpliedMove).
//
// Correlation is a plain Pearson over historical returns — no mathjs dependency
// needed (it isn't in the stack); ~10 lines does it and stays testable.

import { computePositionRisk, type TradeSide } from "./core";

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

// ===== Position model the Radar runs on =====

export interface PortfolioPosition {
  symbol: string;
  sector: string;
  instrument: "equity" | "option" | "future";
  quantity: number; // signed shares (negative = short)
  avgPrice: number; // entry per share / option premium
  lastPrice: number; // current per share / option premium
  priceHistory: number[]; // underlying closes, for correlation + implied move
  spot: number; // underlying spot
  // option-only:
  side?: "long" | "short";
  optionType?: "CE" | "PE";
  strike?: number;
  expiry?: string; // ISO date
  lotSize?: number;
  iv?: number; // underlying ATM IV % (for implied move)
}

/** Capital committed to a position — market value of the leg. Used for the
 *  concentration view (how much of the book each bet represents). */
export function deployedValue(p: PortfolioPosition): number {
  return Math.abs(p.quantity) * p.lastPrice;
}

/** Underlying notional (|shares| × spot) — the exposure that moves with the
 *  stock. Used for the implied-move aggregate, not concentration. */
function notionalValue(p: PortfolioPosition): number {
  return Math.abs(p.quantity) * p.spot;
}

// ===== Concentration =====

export interface ConcentrationSlice {
  label: string;
  value: number;
  pct: number;
  flagged: boolean;
}

export interface Concentration {
  total: number;
  byName: ConcentrationSlice[];
  bySector: ConcentrationSlice[];
  flags: { kind: "name" | "sector"; label: string; pct: number }[];
}

export interface ConcentrationThresholds {
  namePct?: number; // default 25
  sectorPct?: number; // default 40
}

/** % of the book in any single name / sector, flagged past the thresholds
 *  (defaults: 25% one name, 40% one sector). */
export function computeConcentration(
  positions: PortfolioPosition[],
  t: ConcentrationThresholds = {},
): Concentration {
  const namePct = t.namePct ?? 25;
  const sectorPct = t.sectorPct ?? 40;
  const total = positions.reduce((a, p) => a + deployedValue(p), 0);

  const nameMap = new Map<string, number>();
  const sectorMap = new Map<string, number>();
  for (const p of positions) {
    const v = deployedValue(p);
    nameMap.set(p.symbol, (nameMap.get(p.symbol) ?? 0) + v);
    sectorMap.set(p.sector || "—", (sectorMap.get(p.sector || "—") ?? 0) + v);
  }

  const toSlices = (m: Map<string, number>, threshold: number): ConcentrationSlice[] =>
    Array.from(m.entries())
      .map(([label, value]) => {
        const pct = total > 0 ? round1((value / total) * 100) : 0;
        return { label, value: round2(value), pct, flagged: pct > threshold };
      })
      .sort((a, b) => b.value - a.value);

  const byName = toSlices(nameMap, namePct);
  const bySector = toSlices(sectorMap, sectorPct);
  const flags = [
    ...byName.filter((s) => s.flagged).map((s) => ({ kind: "name" as const, label: s.label, pct: s.pct })),
    ...bySector.filter((s) => s.flagged).map((s) => ({ kind: "sector" as const, label: s.label, pct: s.pct })),
  ];

  return { total: round2(total), byName, bySector, flags };
}

// ===== Correlation =====

function toReturns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) r.push(prices[i] / prices[i - 1] - 1);
  }
  return r;
}

/** Pearson correlation of two return series. null when there isn't enough
 *  overlapping history (need ≥5 points) or a series is flat. */
export function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 5) return null;
  const x = a.slice(a.length - n);
  const y = b.slice(b.length - n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return null;
  return round2(cov / Math.sqrt(vx * vy));
}

export interface CorrelatedCluster {
  symbols: string[];
  value: number; // combined deployed value
  pct: number; // % of book
  avgCorrelation: number; // average pairwise correlation within the cluster
}

/** Group positions whose underlyings move together (pairwise correlation above
 *  `threshold`, default 0.7) into clusters — flagging when several "different"
 *  positions are effectively one concentrated bet. Aggregates same-symbol
 *  positions (e.g. an equity holding + its options) under one node. */
export function computeCorrelatedClusters(
  positions: PortfolioPosition[],
  threshold = 0.7,
): CorrelatedCluster[] {
  // One node per underlying symbol, with its combined value + a return series.
  const bySymbol = new Map<string, { value: number; returns: number[]; sector: string }>();
  for (const p of positions) {
    const node = bySymbol.get(p.symbol);
    const value = deployedValue(p);
    if (node) node.value += value;
    else bySymbol.set(p.symbol, { value, returns: toReturns(p.priceHistory), sector: p.sector });
  }
  const syms = Array.from(bySymbol.keys()).filter((s) => bySymbol.get(s)!.returns.length >= 5);
  const total = positions.reduce((a, p) => a + deployedValue(p), 0);

  // Adjacency via pairwise correlation; connected components = clusters.
  const adj = new Map<string, Set<string>>();
  const corrOf = new Map<string, number>();
  for (const s of syms) adj.set(s, new Set());
  for (let i = 0; i < syms.length; i++) {
    for (let j = i + 1; j < syms.length; j++) {
      const c = pearson(bySymbol.get(syms[i])!.returns, bySymbol.get(syms[j])!.returns);
      if (c !== null && c >= threshold) {
        adj.get(syms[i])!.add(syms[j]);
        adj.get(syms[j])!.add(syms[i]);
        corrOf.set(`${syms[i]}|${syms[j]}`, c);
      }
    }
  }

  const seen = new Set<string>();
  const clusters: CorrelatedCluster[] = [];
  for (const s of syms) {
    if (seen.has(s) || adj.get(s)!.size === 0) continue;
    // BFS the component
    const comp: string[] = [];
    const queue = [s];
    seen.add(s);
    while (queue.length) {
      const cur = queue.shift()!;
      comp.push(cur);
      for (const nb of adj.get(cur)!) if (!seen.has(nb)) (seen.add(nb), queue.push(nb));
    }
    if (comp.length < 2) continue;
    const value = comp.reduce((a, sym) => a + bySymbol.get(sym)!.value, 0);
    const pairCorrs: number[] = [];
    for (let i = 0; i < comp.length; i++)
      for (let j = i + 1; j < comp.length; j++) {
        const c = corrOf.get(`${comp[i]}|${comp[j]}`) ?? corrOf.get(`${comp[j]}|${comp[i]}`);
        if (c !== undefined) pairCorrs.push(c);
      }
    clusters.push({
      symbols: comp.sort(),
      value: round2(value),
      pct: total > 0 ? round1((value / total) * 100) : 0,
      avgCorrelation: pairCorrs.length ? round2(pairCorrs.reduce((a, b) => a + b, 0) / pairCorrs.length) : threshold,
    });
  }
  return clusters.sort((a, b) => b.value - a.value);
}

// ===== Combined F&O max-loss =====

function sideToTradeSide(p: PortfolioPosition): TradeSide {
  const long = (p.side ?? (p.quantity >= 0 ? "long" : "short")) === "long";
  const call = p.optionType === "CE";
  if (long) return call ? "buy_call" : "buy_put";
  return call ? "sell_call" : "sell_put";
}

export interface FnoRisk {
  totalMaxLoss: number; // ₹ across all defined-risk legs
  unbounded: boolean; // true if any naked short call is open
  pctOfCapital: number | null;
  legs: { symbol: string; maxLoss: number | null; unbounded: boolean }[];
}

/** Sum the Phase-9 per-position max-loss across all open option legs and weigh
 *  it against stated capital. A single naked short call makes the whole book's
 *  loss unbounded — surfaced explicitly, never hidden behind a finite sum. */
export function computeFnoRisk(positions: PortfolioPosition[], capital: number | null): FnoRisk {
  const options = positions.filter((p) => p.instrument === "option" && p.strike != null && p.lotSize);
  let total = 0;
  let unbounded = false;
  const legs = options.map((p) => {
    const contracts = Math.max(1, Math.round(Math.abs(p.quantity) / (p.lotSize || 1)));
    const r = computePositionRisk({
      side: sideToTradeSide(p),
      strike: p.strike!,
      premium: p.avgPrice,
      lotSize: p.lotSize!,
      contracts,
      spot: p.spot,
    });
    if (r.maxLossUnbounded) unbounded = true;
    else total += r.maxLoss ?? 0;
    return { symbol: p.symbol, maxLoss: r.maxLoss, unbounded: r.maxLossUnbounded };
  });
  return {
    totalMaxLoss: round2(total),
    unbounded,
    pctOfCapital: capital && capital > 0 && !unbounded ? round1((total / capital) * 100) : null,
    legs,
  };
}

// ===== Clustered expiry exposure =====

export interface ExpiryBucket {
  expiry: string;
  positions: number;
  maxLoss: number;
  unbounded: boolean;
  clustered: boolean; // ≥2 positions share this expiry
}

/** Group option legs by expiry date and flag expiries carrying multiple
 *  positions — same-day risk that reads fine leg-by-leg but stacks up. */
export function computeExpiryExposure(positions: PortfolioPosition[]): ExpiryBucket[] {
  const options = positions.filter((p) => p.instrument === "option" && p.expiry && p.strike != null && p.lotSize);
  const map = new Map<string, PortfolioPosition[]>();
  for (const p of options) {
    const key = p.expiry!;
    (map.get(key) ?? map.set(key, []).get(key)!).push(p);
  }
  return Array.from(map.entries())
    .map(([expiry, ps]) => {
      let maxLoss = 0;
      let unbounded = false;
      for (const p of ps) {
        const contracts = Math.max(1, Math.round(Math.abs(p.quantity) / (p.lotSize || 1)));
        const r = computePositionRisk({
          side: sideToTradeSide(p),
          strike: p.strike!,
          premium: p.avgPrice,
          lotSize: p.lotSize!,
          contracts,
          spot: p.spot,
        });
        if (r.maxLossUnbounded) unbounded = true;
        else maxLoss += r.maxLoss ?? 0;
      }
      return {
        expiry,
        positions: ps.length,
        maxLoss: round2(maxLoss),
        unbounded,
        clustered: ps.length >= 2,
      };
    })
    .sort((a, b) => a.expiry.localeCompare(b.expiry));
}

// ===== Portfolio implied move =====

export interface PortfolioImpliedMove {
  oneSD: number; // ₹, aggregate under independence assumption (a LOWER bound)
  twoSD: number;
  pctOfValue: number | null; // oneSD as % of total notional
  basis: number; // total notional the move is measured against
}

/** Aggregate ±1SD rupee move across the book. Each position's rupee sensitivity
 *  is notional × (IV × √(dte/365)); we combine in quadrature (variances add),
 *  which is exact only if underlyings are independent. Real correlation makes
 *  the true move LARGER — so this is deliberately a lower bound, and the UI must
 *  say so. Options are treated at underlying-notional (delta≈1 simplification),
 *  which further means this understates hedged books and overstates far-OTM
 *  ones; v1 precision is intentionally modest. */
export function computePortfolioImpliedMove(positions: PortfolioPosition[]): PortfolioImpliedMove {
  const now = Date.now();
  let sumSq = 0;
  let basis = 0;
  for (const p of positions) {
    const iv = p.iv ?? 0;
    if (iv <= 0) continue;
    let dteDays = 30; // equity default horizon
    if (p.expiry) {
      const exp = new Date(p.expiry + "T15:30:00").getTime();
      dteDays = Math.max(1, Math.ceil((exp - now) / 86400000));
    }
    const f = (iv / 100) * Math.sqrt(dteDays / 365);
    const notional = notionalValue(p);
    const sigmaRupees = notional * f;
    sumSq += sigmaRupees * sigmaRupees;
    basis += notional;
  }
  const oneSD = Math.sqrt(sumSq);
  return {
    oneSD: round2(oneSD),
    twoSD: round2(oneSD * 2),
    pctOfValue: basis > 0 ? round1((oneSD / basis) * 100) : null,
    basis: round2(basis),
  };
}

// ===== Assembled radar =====

export interface PortfolioRadar {
  positionCount: number;
  totalValue: number;
  concentration: Concentration;
  clusters: CorrelatedCluster[];
  fno: FnoRisk;
  expiry: ExpiryBucket[];
  impliedMove: PortfolioImpliedMove;
  flagCount: number;
}

export function buildPortfolioRadar(
  positions: PortfolioPosition[],
  capital: number | null,
  thresholds: ConcentrationThresholds = {},
): PortfolioRadar {
  const concentration = computeConcentration(positions, thresholds);
  const clusters = computeCorrelatedClusters(positions);
  const fno = computeFnoRisk(positions, capital);
  const expiry = computeExpiryExposure(positions);
  const impliedMove = computePortfolioImpliedMove(positions);
  const flagCount =
    concentration.flags.length +
    clusters.length +
    (fno.unbounded ? 1 : 0) +
    expiry.filter((e) => e.clustered).length;
  return {
    positionCount: positions.length,
    totalValue: concentration.total,
    concentration,
    clusters,
    fno,
    expiry,
    impliedMove,
    flagCount,
  };
}
