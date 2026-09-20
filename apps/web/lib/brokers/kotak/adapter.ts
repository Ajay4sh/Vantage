// Phase 10.4 — Kotak Neo adapter (Trade API). Read-only here: the SEBI static-IP
// whitelisting requirement applies to ORDER-related calls, not data reads, so
// positions/quotes are usable without it (execution is out of scope this phase
// regardless). Kotak's auth is multi-step (consumer key/secret → access token →
// a login session token via mobile+MPIN/OTP), refreshed out-of-band; we treat
// the resulting tokens as env-provided session material.
//
// No test account here → endpoints are written to the documented Neo shape and
// are UNVERIFIED. `configured()` gates it off until tokens are set; methods we
// can't responsibly implement without verification throw rather than fabricate.

import type { Candle } from "../../types";
import type {
  BrokerAdapter,
  BrokerCredentials,
  BrokerPosition,
  BrokerQuote,
  BrokerSession,
  NormalizedChain,
  PositionInstrument,
} from "../types";

const BASE = "https://gw-napi.kotaksecurities.com";

function creds(): { accessToken?: string; sessionToken?: string } {
  return {
    accessToken: process.env.KOTAK_ACCESS_TOKEN,
    sessionToken: process.env.KOTAK_SESSION_TOKEN,
  };
}

interface RawNeoPosition {
  trdSym?: string; // trading symbol
  sym?: string;
  flBuyQty?: string | number;
  flSellQty?: string | number;
  buyAmt?: string | number;
  sellAmt?: string | number;
  lastPrice?: string | number;
  prod?: string;
  optTp?: string; // CE | PE | XX
  stkPrc?: string | number;
  expDt?: string;
  segment?: string;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function mapPosition(r: RawNeoPosition): BrokerPosition {
  const opt = r.optTp === "CE" || r.optTp === "PE";
  const instrument: PositionInstrument = opt ? "option" : /FUT/i.test(r.trdSym ?? "") ? "future" : "equity";
  const netQty = num(r.flBuyQty) - num(r.flSellQty);
  return {
    symbol: (r.sym || r.trdSym || "").split(/[\s-]/)[0].toUpperCase(),
    instrument,
    quantity: netQty,
    avgPrice: netQty !== 0 ? Math.abs(num(r.buyAmt) - num(r.sellAmt)) / Math.abs(netQty) : 0,
    lastPrice: num(r.lastPrice),
    product: r.prod,
    ...(opt
      ? {
          optionType: r.optTp as "CE" | "PE",
          side: netQty >= 0 ? ("long" as const) : ("short" as const),
          strike: r.stkPrc != null ? num(r.stkPrc) : undefined,
          expiry: r.expDt,
        }
      : {}),
  };
}

export const kotakAdapter: BrokerAdapter = {
  id: "kotak",
  label: "Kotak Neo",

  configured() {
    const { accessToken, sessionToken } = creds();
    return !!(accessToken && sessionToken);
  },

  async authenticate(credentials: BrokerCredentials): Promise<BrokerSession> {
    const accessToken = credentials.accessToken ?? creds().accessToken;
    const sessionToken = credentials.sessionToken ?? creds().sessionToken;
    if (!accessToken || !sessionToken) {
      throw new Error("Kotak Neo: KOTAK_ACCESS_TOKEN and KOTAK_SESSION_TOKEN required");
    }
    return { brokerId: "kotak", accessToken, meta: { sessionToken } };
  },

  async getPositions(session?: BrokerSession): Promise<BrokerPosition[]> {
    const s = session ?? (await this.authenticate({}));
    const res = await fetch(`${BASE}/Positions/2.0/positions`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${s.accessToken}`,
        Auth: String(s.meta?.sessionToken ?? ""),
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Kotak Neo positions failed: ${res.status}`);
    const body = (await res.json()) as { data?: RawNeoPosition[] } | RawNeoPosition[];
    const rows = Array.isArray(body) ? body : (body.data ?? []);
    return rows.map(mapPosition).filter((p) => p.quantity !== 0);
  },

  async getQuote(): Promise<BrokerQuote> {
    throw new Error("Kotak Neo getQuote not implemented yet — verify Neo quote endpoint against a live account");
  },
  async getHistoricalCandles(): Promise<Candle[]> {
    throw new Error("Kotak Neo getHistoricalCandles not implemented yet — verify Neo chart endpoint first");
  },
  async getOptionChain(): Promise<NormalizedChain> {
    throw new Error("Kotak Neo getOptionChain not implemented yet — verify Neo option-chain endpoint first");
  },
};
