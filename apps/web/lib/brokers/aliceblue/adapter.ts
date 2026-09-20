// Phase 10.3 — Alice Blue adapter (ANT API, REST). Session auth is SHA-256 over
// (User ID + API Key + encryption key), per Alice Blue's documented flow. It's
// a free, documented API — but there's no test account in this environment, so
// the endpoints below are written to the documented ANT shape and are UNVERIFIED
// against a live account. `configured()` gates it off until credentials are set,
// and the methods we can't responsibly stub-with-guesses throw rather than
// returning fabricated data (Phase 10 guardrail: no reverse-engineering, no
// guessing at data shapes we haven't confirmed).
//
// Verify BASE + field names against current ANT docs before relying on this.

import { createHash } from "node:crypto";
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

const BASE = "https://ant.aliceblueonline.com/rest/AliceBlueAPIService/api";

function creds(): { userId?: string; apiKey?: string } {
  return { userId: process.env.ALICEBLUE_USER_ID, apiKey: process.env.ALICEBLUE_API_KEY };
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

interface RawAbPosition {
  Tsym?: string;
  Netqty?: string | number;
  NetAvgPrc?: string | number;
  Avgprc?: string | number;
  LTP?: string | number;
  Pcode?: string;
  Exseg?: string;
  Opttype?: string; // CE | PE | XX
  Strkprc?: string | number;
  Expdate?: string;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function mapPosition(r: RawAbPosition): BrokerPosition {
  const opt = r.Opttype === "CE" || r.Opttype === "PE";
  const instrument: PositionInstrument = opt ? "option" : /FUT/i.test(r.Tsym ?? "") ? "future" : "equity";
  const qty = num(r.Netqty);
  return {
    symbol: (r.Tsym ?? "").split(/[\s-]/)[0].toUpperCase(),
    instrument,
    quantity: qty,
    avgPrice: num(r.NetAvgPrc ?? r.Avgprc),
    lastPrice: num(r.LTP),
    product: r.Pcode,
    ...(opt
      ? {
          optionType: r.Opttype as "CE" | "PE",
          side: qty >= 0 ? ("long" as const) : ("short" as const),
          strike: r.Strkprc != null ? num(r.Strkprc) : undefined,
          expiry: r.Expdate,
        }
      : {}),
  };
}

export const aliceBlueAdapter: BrokerAdapter = {
  id: "aliceblue",
  label: "Alice Blue",

  configured() {
    const { userId, apiKey } = creds();
    return !!(userId && apiKey);
  },

  async authenticate(credentials: BrokerCredentials): Promise<BrokerSession> {
    const userId = credentials.userId ?? creds().userId;
    const apiKey = credentials.apiKey ?? creds().apiKey;
    if (!userId || !apiKey) throw new Error("Alice Blue: ALICEBLUE_USER_ID / ALICEBLUE_API_KEY required");

    // 1) fetch the per-session encryption key
    const encRes = await fetch(`${BASE}/customer/getAPIEncpkey`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!encRes.ok) throw new Error(`Alice Blue enc-key request failed: ${encRes.status}`);
    const encKey = ((await encRes.json()) as { encKey?: string }).encKey;
    if (!encKey) throw new Error("Alice Blue: no encKey in response");

    // 2) exchange sha256(userId + apiKey + encKey) for a session id
    const userData = sha256(`${userId}${apiKey}${encKey}`);
    const sidRes = await fetch(`${BASE}/customer/getUserSID`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, userData }),
    });
    if (!sidRes.ok) throw new Error(`Alice Blue session request failed: ${sidRes.status}`);
    const sessionID = ((await sidRes.json()) as { sessionID?: string }).sessionID;
    if (!sessionID) throw new Error("Alice Blue: no sessionID in response");

    return { brokerId: "aliceblue", accessToken: sessionID, meta: { userId } };
  },

  async getPositions(session?: BrokerSession): Promise<BrokerPosition[]> {
    const s = session ?? (await this.authenticate({}));
    const userId = String(s.meta?.userId ?? creds().userId ?? "");
    const res = await fetch(`${BASE}/positionAndHoldings/positionBook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userId} ${s.accessToken}`,
      },
      body: JSON.stringify({ ret: "NET" }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Alice Blue positionBook failed: ${res.status}`);
    const body = (await res.json()) as RawAbPosition[] | { stat?: string; data?: RawAbPosition[] };
    const rows = Array.isArray(body) ? body : (body.data ?? []);
    return rows.map(mapPosition).filter((p) => p.quantity !== 0);
  },

  // Not stubbed with guessed shapes — implement + verify against a live account
  // before use, so the app never renders unverified market data as real.
  async getQuote(): Promise<BrokerQuote> {
    throw new Error("Alice Blue getQuote not implemented yet — verify ANT quote endpoint against a live account");
  },
  async getHistoricalCandles(): Promise<Candle[]> {
    throw new Error("Alice Blue getHistoricalCandles not implemented yet — verify ANT chart endpoint first");
  },
  async getOptionChain(): Promise<NormalizedChain> {
    throw new Error("Alice Blue getOptionChain not implemented yet — verify ANT option-chain endpoint first");
  },
};
