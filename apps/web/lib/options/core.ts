// Phase 3: options analytics engine. Standard, textbook formulae throughout —
// Black-Scholes greeks, writers'-payout max pain, close-to-close realized
// volatility, IV-vs-RV premium, and OTM put/call skew — assembled into
// discrete signal readouts.
//
// Framing rule (build instructions §0/§6, keep it): every signal here
// describes what the options market is currently pricing. None of it is a
// forecast or trade advice, and the UI copy must never drift that way.
//
// Pure functions, unit-tested in tests/options.test.ts.

import type { GreeksRow, OptionsAnalytics, OptionsSignal } from "../types";

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// ===== Normal distribution helpers =====

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/** Abramowitz & Stegun 7.1.26 erf approximation — max error ~1.5e-7,
 *  far below anything visible at one-decimal greeks. */
function normCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) *
      Math.exp(-x * x);
  const erf = x >= 0 ? y : -y;
  return 0.5 * (1 + erf);
}

// ===== Black-Scholes greeks =====

export interface BsInputs {
  spot: number;
  strike: number;
  ivPct: number;
  dteDays: number;
  ratePct?: number; // annualized risk-free rate; ~repo rate for India
}

export interface BsGreeks {
  callDelta: number;
  putDelta: number;
  gamma: number;
  callTheta: number; // per calendar day
  putTheta: number;
  vega: number; // per 1 vol point
}

export function bsGreeks(i: BsInputs): BsGreeks {
  const T = Math.max(i.dteDays, 0.5) / 365;
  const sigma = Math.max(i.ivPct, 0.01) / 100;
  const r = (i.ratePct ?? 6.5) / 100;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(i.spot / i.strike) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const callDelta = normCdf(d1);
  const discount = Math.exp(-r * T);
  const thetaCommon = -(i.spot * normPdf(d1) * sigma) / (2 * sqrtT);

  return {
    callDelta,
    putDelta: callDelta - 1, // put-call parity
    gamma: normPdf(d1) / (i.spot * sigma * sqrtT),
    callTheta: (thetaCommon - r * i.strike * discount * normCdf(d2)) / 365,
    putTheta: (thetaCommon + r * i.strike * discount * normCdf(-d2)) / 365,
    vega: (i.spot * normPdf(d1) * sqrtT) / 100,
  };
}

/** Black-Scholes fair value of a European option, per share. Used to
 *  pre-estimate a plausible premium in the Phase 9 trade builder when a live
 *  option LTP isn't to hand — always shown as an editable estimate, never a
 *  quote. */
export function bsPrice(
  spot: number,
  strike: number,
  ivPct: number,
  dteDays: number,
  kind: "call" | "put",
  ratePct = 6.5,
): number {
  const T = Math.max(dteDays, 0.5) / 365;
  const sigma = Math.max(ivPct, 0.01) / 100;
  const r = ratePct / 100;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(spot / strike) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const disc = Math.exp(-r * T);
  const price =
    kind === "call"
      ? spot * normCdf(d1) - strike * disc * normCdf(d2)
      : strike * disc * normCdf(-d2) - spot * normCdf(-d1);
  return Math.max(0, Math.round(price * 100) / 100);
}

// ===== Max pain =====

/** The expiry price that minimizes total intrinsic payout by option writers:
 *  argmin over K of Σ callOI_j·max(0, K−S_j) + Σ putOI_j·max(0, S_j−K).
 *  Ties resolve to the lowest strike. */
export function computeMaxPain(strikes: number[], callOI: number[], putOI: number[]): number {
  let best = strikes[0];
  let bestPain = Infinity;
  for (const k of strikes) {
    let pain = 0;
    for (let j = 0; j < strikes.length; j++) {
      pain += callOI[j] * Math.max(0, k - strikes[j]);
      pain += putOI[j] * Math.max(0, strikes[j] - k);
    }
    if (pain < bestPain) {
      bestPain = pain;
      best = k;
    }
  }
  return best;
}

// ===== Realized volatility =====

/** Close-to-close realized volatility over the last `window` sessions,
 *  annualized (√252) and in %. Null when there isn't enough history to be
 *  meaningful. */
export function realizedVol(closes: number[], window = 20): number | null {
  const usable = closes.slice(-(window + 1)).filter((c) => c > 0);
  if (usable.length < 7) return null;
  const rets: number[] = [];
  for (let i = 1; i < usable.length; i++) rets.push(Math.log(usable[i] / usable[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (rets.length - 1);
  return round1(Math.sqrt(variance) * Math.sqrt(252) * 100);
}

// ===== Synthetic smile (sample mode only) =====

/** The demo data carries one flat IV. Until real per-strike IV arrives from
 *  the chain, synthesize a gentle equity smile around it — puts richer than
 *  calls, IV rising with distance from ATM — so the greeks table and skew
 *  read are demoable. Clearly labelled sample data either way. */
export function synthesizeSmile(
  flatIvPct: number,
  strikes: number[],
  spot: number,
): { callIV: number[]; putIV: number[] } {
  const callIV = strikes.map((k) => round1(flatIvPct * (1 + 0.6 * Math.abs(Math.log(k / spot)) * 4)));
  const putIV = strikes.map((k) => round1(flatIvPct * (1 + 1.0 * Math.abs(Math.log(k / spot)) * 4)));
  return { callIV, putIV };
}

// ===== Analytics assembly =====

export interface ChainInput {
  source: "sample" | "live";
  spot: number;
  expiry: string; // display string
  dte: number;
  strikes: number[];
  callOI: number[];
  putOI: number[];
  callIV: number[];
  putIV: number[];
  closes: number[]; // recent daily closes for realized vol
}

export function buildOptionsAnalytics(input: ChainInput): OptionsAnalytics {
  const { strikes, callOI, putOI, callIV, putIV, spot } = input;

  const totalCall = callOI.reduce((a, b) => a + b, 0);
  const totalPut = putOI.reduce((a, b) => a + b, 0);
  const pcr = totalCall > 0 ? round2(totalPut / totalCall) : 1;

  const maxPain = computeMaxPain(strikes, callOI, putOI);
  const oiSupport = strikes[putOI.indexOf(Math.max(...putOI))];
  const oiResistance = strikes[callOI.indexOf(Math.max(...callOI))];

  let atmIdx = 0;
  for (let i = 1; i < strikes.length; i++) {
    if (Math.abs(strikes[i] - spot) < Math.abs(strikes[atmIdx] - spot)) atmIdx = i;
  }
  const ivAtm = round1((callIV[atmIdx] + putIV[atmIdx]) / 2);

  const rv20 = realizedVol(input.closes);
  const ivPremiumPct = rv20 !== null && rv20 > 0 ? Math.round((ivAtm / rv20 - 1) * 100) : null;

  const otmPutIVs = strikes.map((k, i) => (k < spot ? putIV[i] : null)).filter((v): v is number => v !== null);
  const otmCallIVs = strikes.map((k, i) => (k > spot ? callIV[i] : null)).filter((v): v is number => v !== null);
  const skewPts =
    otmPutIVs.length && otmCallIVs.length
      ? round1(
          otmPutIVs.reduce((a, b) => a + b, 0) / otmPutIVs.length -
            otmCallIVs.reduce((a, b) => a + b, 0) / otmCallIVs.length,
        )
      : null;

  const greeks: GreeksRow[] = [];
  for (let i = Math.max(0, atmIdx - 2); i <= Math.min(strikes.length - 1, atmIdx + 2); i++) {
    const iv = round1((callIV[i] + putIV[i]) / 2);
    const g = bsGreeks({ spot, strike: strikes[i], ivPct: iv, dteDays: input.dte });
    greeks.push({
      strike: strikes[i],
      iv,
      callDelta: round2(g.callDelta),
      putDelta: round2(g.putDelta),
      gamma: Math.round(g.gamma * 10000) / 10000,
      callTheta: round2(g.callTheta),
      vega: round2(g.vega),
      atm: i === atmIdx,
    });
  }

  // ---- Discrete signals ----
  const signals: OptionsSignal[] = [];

  // 1. Positioning: the classic PCR read (puts written = floors being sold
  //    under the market) plus where the OI walls sit.
  const posScore = clamp((pcr - 1) * 60, -30, 30);
  signals.push(
    pcr >= 1.1
      ? {
          name: "Positioning",
          state: "Bullish tilt",
          tone: "pos",
          detail: `PCR ${pcr} — put writers dominant. Heaviest put OI (support) ₹${oiSupport}, call wall ₹${oiResistance}.`,
        }
      : pcr <= 0.9
        ? {
            name: "Positioning",
            state: "Bearish tilt",
            tone: "neg",
            detail: `PCR ${pcr} — call writers dominant. Call wall (resistance) ₹${oiResistance}, put base ₹${oiSupport}.`,
          }
        : {
            name: "Positioning",
            state: "Neutral",
            tone: "neu",
            detail: `PCR ${pcr} — balanced writing. OI walls: support ₹${oiSupport}, resistance ₹${oiResistance}.`,
          },
  );

  // 2. Volatility pricing: is premium rich or cheap vs what the stock has
  //    actually been moving? Not directional — it prices strategies, not sides.
  if (ivPremiumPct === null || rv20 === null) {
    signals.push({
      name: "Volatility pricing",
      state: "Unknown",
      tone: "neu",
      detail: "Not enough price history to compute realized volatility.",
    });
  } else if (ivPremiumPct >= 25) {
    signals.push({
      name: "Volatility pricing",
      state: "Rich",
      tone: "neg",
      detail: `ATM IV ${ivAtm}% vs 20-day realized ${rv20}% (+${ivPremiumPct}%) — premium expensive; favours option sellers over buyers.`,
    });
  } else if (ivPremiumPct <= -10) {
    signals.push({
      name: "Volatility pricing",
      state: "Cheap",
      tone: "pos",
      detail: `ATM IV ${ivAtm}% vs 20-day realized ${rv20}% (${ivPremiumPct}%) — premium cheap relative to recent movement.`,
    });
  } else {
    signals.push({
      name: "Volatility pricing",
      state: "Fair",
      tone: "neu",
      detail: `ATM IV ${ivAtm}% vs 20-day realized ${rv20}% (${ivPremiumPct >= 0 ? "+" : ""}${ivPremiumPct}%) — premium roughly in line with recent movement.`,
    });
  }

  // 3. Max-pain gravity: a weak, expiry-week effect at best — the detail says so.
  const mpDiffPct = round1(((spot - maxPain) / maxPain) * 100);
  const mpScore = clamp(-mpDiffPct * 2, -10, 10);
  if (Math.abs(mpDiffPct) <= 1) {
    signals.push({
      name: "Max pain",
      state: "Pinned",
      tone: "neu",
      detail: `Spot ₹${round2(spot)} sits within 1% of max pain ₹${maxPain}.`,
    });
  } else {
    signals.push({
      name: "Max pain",
      state: mpDiffPct > 0 ? "Spot above" : "Spot below",
      tone: mpDiffPct > 0 ? "neg" : "pos",
      detail: `Spot ₹${round2(spot)} is ${Math.abs(mpDiffPct)}% ${mpDiffPct > 0 ? "above" : "below"} max pain ₹${maxPain} — a weak pull, strongest only in expiry week.`,
    });
  }

  // 4. Skew: hedging demand. Informational — deliberately excluded from the
  //    score because heavy put skew reads bearish or contrarian depending on
  //    who you ask.
  if (skewPts === null) {
    signals.push({
      name: "IV skew",
      state: "Unavailable",
      tone: "neu",
      detail: "Not enough OTM strikes on both sides to measure skew.",
    });
  } else if (skewPts >= 3) {
    signals.push({
      name: "IV skew",
      state: "Put-skewed",
      tone: "neg",
      detail: `OTM puts trade ${skewPts} vol pts over OTM calls — downside protection is being bid.`,
    });
  } else if (skewPts <= -1) {
    signals.push({
      name: "IV skew",
      state: "Call-skewed",
      tone: "pos",
      detail: `OTM calls trade ${Math.abs(skewPts)} vol pts over OTM puts — upside speculation is being bid.`,
    });
  } else {
    signals.push({
      name: "IV skew",
      state: "Balanced",
      tone: "neu",
      detail: `Put/call IV differential ${skewPts} vol pts — no pronounced hedging tilt.`,
    });
  }

  // Net positioning score for the radar: PCR tilt + max-pain pull, scaled to
  // -100..100. Skew and vol-richness are shown but not scored (not directional).
  const score = Math.round(clamp(posScore + mpScore, -40, 40) * 2.5);

  return {
    source: input.source,
    spot: round2(spot),
    expiry: input.expiry,
    dte: input.dte,
    pcr,
    maxPain,
    oiSupport,
    oiResistance,
    rv20,
    ivAtm,
    ivPremiumPct,
    skewPts,
    greeks,
    signals,
    score,
  };
}

export function dteFromIso(expiryIsoDate: string): number {
  const expiry = new Date(expiryIsoDate + "T15:30:00");
  return Math.max(1, Math.ceil((expiry.getTime() - Date.now()) / 86400000));
}
