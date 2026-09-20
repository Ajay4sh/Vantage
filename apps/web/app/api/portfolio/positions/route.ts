// Phase 11 — positions feed for the Portfolio Risk Radar. Live positions come
// from the default configured broker via the Phase 10 BrokerAdapter.getPositions()
// interface (single-broker, per the Radar's gating — multi-broker aggregation is
// a later follow-up). With no broker connected, it returns a clearly-labelled
// demo book built from the seeded universe so the Radar is explorable
// credential-free, consistent with the rest of the app's demo philosophy.

import { NextResponse } from "next/server";
import { anyBrokerConfigured, defaultAdapter } from "@/lib/brokers/registry";
import type { BrokerPosition } from "@/lib/brokers/types";
import { bsPrice } from "@/lib/options";
import { SAMPLE_STOCKS } from "@/lib/sample-data";
import { stockFor } from "@/lib/stock-source";
import type { PortfolioPosition } from "@/lib/risk/portfolio";
import type { Stock } from "@/lib/types";

export const dynamic = "force-dynamic";

function dteOf(expiry: string): number {
  const t = new Date(expiry + "T15:30:00").getTime();
  return Math.max(1, Math.ceil((t - Date.now()) / 86400000));
}

function nearestStrike(strikes: number[], spot: number): number {
  if (!strikes?.length) return Math.round(spot);
  return strikes.reduce((best, k) => (Math.abs(k - spot) < Math.abs(best - spot) ? k : best), strikes[0]);
}

function equityPosition(s: Stock, qty: number): PortfolioPosition {
  return {
    symbol: s.sym,
    sector: s.sector,
    instrument: "equity",
    quantity: qty,
    avgPrice: Math.round(s.price * 0.96 * 100) / 100,
    lastPrice: s.price,
    priceHistory: s.technicals.priceHistory?.length ? s.technicals.priceHistory : s.spark,
    spot: s.price,
    iv: s.options.iv,
  };
}

function optionLeg(s: Stock, side: "long" | "short", type: "CE" | "PE", expiry: string): PortfolioPosition {
  const strike = nearestStrike(s.options.strikes, s.price);
  const lot = s.options.lotSize || 1;
  const premium = bsPrice(s.price, strike, s.options.iv, dteOf(expiry), type === "CE" ? "call" : "put");
  return {
    symbol: s.sym,
    sector: s.sector,
    instrument: "option",
    quantity: side === "long" ? lot : -lot, // one lot
    avgPrice: premium,
    lastPrice: premium,
    priceHistory: s.technicals.priceHistory?.length ? s.technicals.priceHistory : s.spark,
    spot: s.price,
    side,
    optionType: type,
    strike,
    expiry,
    lotSize: lot,
    iv: s.options.iv,
  };
}

/** A representative demo book: concentrated in one name and one sector, with a
 *  naked short call (unbounded) and two option legs sharing an expiry — so every
 *  Radar signal has something real to show. Clearly flagged as sample data. */
function demoPositions(): PortfolioPosition[] {
  const S = SAMPLE_STOCKS;
  const positions: PortfolioPosition[] = [];
  const holdings: [string, number][] = [
    ["RELIANCE", 220], // large single-name weight (Energy)
    ["BPCL", 1200], // second Energy name → sector concentration
    ["HDFCBANK", 120],
    ["TCS", 35],
    ["INFY", 90],
    ["ITC", 400],
  ];
  for (const [sym, qty] of holdings) {
    const s = S[sym];
    if (s) positions.push(equityPosition(s, qty));
  }
  // Shared expiry across two legs to demonstrate clustered expiry exposure.
  const shared = S.RELIANCE?.options.expiryDate ?? S.BPCL?.options.expiryDate;
  if (S.BPCL && shared) positions.push(optionLeg(S.BPCL, "long", "CE", shared));
  if (S.RELIANCE && shared) positions.push(optionLeg(S.RELIANCE, "short", "CE", shared)); // naked short → unbounded
  if (S.HDFCBANK) positions.push(optionLeg(S.HDFCBANK, "long", "PE", S.HDFCBANK.options.expiryDate));
  return positions;
}

/** Enrich a broker's raw positions with the market context the Radar needs
 *  (sector, price history, spot, IV) by resolving each symbol to a Stock. */
async function enrichLive(raw: BrokerPosition[]): Promise<PortfolioPosition[]> {
  const out: PortfolioPosition[] = [];
  for (const p of raw) {
    const stock = SAMPLE_STOCKS[p.symbol] ?? (await stockFor(p.symbol))?.stock;
    if (!stock) continue; // can't assess risk without market context
    out.push({
      symbol: p.symbol,
      sector: stock.sector,
      instrument: p.instrument,
      quantity: p.quantity,
      avgPrice: p.avgPrice,
      lastPrice: p.lastPrice || stock.price,
      priceHistory: stock.technicals.priceHistory?.length ? stock.technicals.priceHistory : stock.spark,
      spot: stock.price,
      side: p.side,
      optionType: p.optionType,
      strike: p.strike,
      expiry: p.expiry,
      lotSize: p.lotSize ?? stock.options.lotSize,
      iv: stock.options.iv,
    });
  }
  return out;
}

export async function GET() {
  if (anyBrokerConfigured()) {
    try {
      const raw = await defaultAdapter().getPositions();
      const positions = await enrichLive(raw);
      return NextResponse.json({ source: "live", broker: defaultAdapter().id, positions });
    } catch (err) {
      // Broker configured but the call failed — surface demo with a note rather
      // than an empty radar, so the view still explains itself.
      return NextResponse.json({
        source: "demo",
        error: err instanceof Error ? err.message : "broker positions unavailable",
        positions: demoPositions(),
      });
    }
  }
  return NextResponse.json({ source: "demo", positions: demoPositions() });
}
