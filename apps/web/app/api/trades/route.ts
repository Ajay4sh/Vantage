// Phase 9 — the self-logged trade journal behind the private loss-pattern
// mirror. GET lists the signed-in user's trades (all, or ?symbol=…); POST logs
// one; DELETE removes one. All routes require a session: the mirror is a
// private, per-user record — there is no anonymous or shared trade log, by
// design (Phase 9 guardrail: private by default, never a leaderboard).

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { deleteTrade, listTrades, logTrade, type TradeLog } from "@/lib/store";

export const dynamic = "force-dynamic";

const STRATEGIES = new Set([
  "buy_call",
  "buy_put",
  "sell_call",
  "sell_put",
  "covered_call",
  "credit_spread",
  "other",
]);

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ trades: [], authed: false });
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase() || undefined;
  return NextResponse.json({ trades: await listTrades(user.id, symbol), authed: true });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to keep a private trade log." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Partial<TradeLog> | null;
  if (!body || typeof body.symbol !== "string" || !body.symbol.trim()) {
    return NextResponse.json({ error: "A symbol is required." }, { status: 400 });
  }
  const strategyType = STRATEGIES.has(String(body.strategyType)) ? String(body.strategyType) : "other";
  const expiryDate =
    typeof body.expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.expiryDate)
      ? body.expiryDate
      : null;

  const trade = await logTrade({
    userId: user.id,
    symbol: body.symbol.toUpperCase().slice(0, 24),
    strategyType,
    expiryDate,
    entryPrice: num(body.entryPrice),
    exitPrice: num(body.exitPrice),
    pnl: num(body.pnl),
  });
  return NextResponse.json({ trade });
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const ok = await deleteTrade(user.id, id);
  return NextResponse.json({ deleted: ok });
}
