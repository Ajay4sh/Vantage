// Pro redesign — order endpoint. Routes an order through the gated execution
// module (paper unless the owner has explicitly enabled live execution with
// their own broker token). A signed-in user's paper/live order is also written
// to the trade journal so it shows up in the Portfolio / loss-pattern mirror.

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { executionMode, submitOrder, type OrderRequest } from "@/lib/execution";
import { logTrade } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  // Lets the UI show whether it's in paper or live mode.
  return NextResponse.json({ mode: executionMode() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Partial<OrderRequest> | null;
  if (!body || typeof body.symbol !== "string" || (body.side !== "buy" && body.side !== "sell")) {
    return NextResponse.json({ error: "symbol and side are required" }, { status: 400 });
  }
  const order: OrderRequest = {
    symbol: body.symbol.toUpperCase().slice(0, 24),
    side: body.side,
    qty: typeof body.qty === "number" && body.qty > 0 ? Math.round(body.qty) : 1,
    orderType: body.orderType === "limit" ? "limit" : "market",
    price: typeof body.price === "number" ? body.price : undefined,
    product: typeof body.product === "string" ? body.product : undefined,
    kind: body.kind === "strategy" ? "strategy" : "equity",
    summary: typeof body.summary === "string" ? body.summary.slice(0, 240) : undefined,
  };

  const confirmation = await submitOrder(order);

  // Journal it for signed-in users (paper or live), so Portfolio/mirror reflect it.
  const user = await currentUser();
  if (user && confirmation.status !== "rejected") {
    await logTrade({
      userId: user.id,
      symbol: order.symbol,
      strategyType: order.kind === "strategy" ? "other" : order.side === "buy" ? "buy_call" : "sell_call",
      expiryDate: null,
      entryPrice: order.price ?? null,
      exitPrice: null,
      pnl: null,
    }).catch(() => {});
  }

  return NextResponse.json({ confirmation });
}
