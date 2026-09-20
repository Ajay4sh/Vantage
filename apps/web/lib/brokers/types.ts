// Phase 10 — broker-agnostic adapter layer. Every broker integration
// implements the same `BrokerAdapter` interface; the rest of the app (tabs,
// risk engine, the Phase 11 Portfolio Risk Radar) talks to this interface, not
// to any one broker's raw API. That's what makes adding or removing a broker
// cheap — and it's why the Radar can be built against `getPositions()` today
// and gain multi-broker aggregation later without touching the Radar itself.
//
// Scope guardrail (Phase 10): this layer is read-access only — quotes, candles,
// positions, option chains. No order placement. Adding execution reopens
// regulatory questions and is a separate, explicit decision.

import type { Candle } from "../types";
import type { NormalizedChain } from "../upstox/client";

export type BrokerId = "upstox" | "aliceblue" | "kotak";

/** A normalized quote, broker-independent. */
export interface BrokerQuote {
  symbol: string;
  last: number;
  netChange: number;
  changePct: number;
}

export type PositionInstrument = "equity" | "option" | "future";
export type OptionType = "CE" | "PE";
export type PositionSide = "long" | "short";

/** One open position, normalized across brokers. Quantities are in shares
 *  (signed: negative = net short). Option legs carry the extra fields the
 *  Phase 9 risk math needs to compute max-loss and expiry exposure. */
export interface BrokerPosition {
  symbol: string; // underlying trading symbol, e.g. RELIANCE
  instrument: PositionInstrument;
  quantity: number; // signed net quantity in shares
  avgPrice: number; // average entry price (per share, or premium for options)
  lastPrice: number; // current LTP (per share, or premium for options)
  product?: string; // CNC | MIS | NRML | ...
  sector?: string; // enriched downstream when the broker doesn't provide it
  // Option-only:
  optionType?: OptionType;
  side?: PositionSide;
  strike?: number;
  expiry?: string; // ISO date (YYYY-MM-DD)
  lotSize?: number;
}

export interface BrokerSession {
  brokerId: BrokerId;
  accessToken?: string;
  expiresAt?: string;
  meta?: Record<string, unknown>;
}

/** Free-form per-broker credential bag (env-backed). Kept as a flat map so the
 *  encryption-at-rest / session-refresh handling can be identical across
 *  adapters — one security review, not four (Phase 10 guardrail). */
export type BrokerCredentials = Record<string, string | undefined>;

/** The one interface every broker adapter implements. */
export interface BrokerAdapter {
  readonly id: BrokerId;
  readonly label: string;
  /** True when the required credentials are present in the environment. */
  configured(): boolean;
  authenticate(credentials: BrokerCredentials): Promise<BrokerSession>;
  getQuote(symbol: string): Promise<BrokerQuote>;
  getHistoricalCandles(symbol: string, interval: string, range: string): Promise<Candle[]>;
  /** Aggregated open positions — the data the Phase 11 Risk Radar runs on. */
  getPositions(session?: BrokerSession): Promise<BrokerPosition[]>;
  getOptionChain(symbol: string, expiry: string): Promise<NormalizedChain>;
}

export type { NormalizedChain } from "../upstox/client";
