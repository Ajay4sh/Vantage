// Pro redesign — order execution, gated. This exists because the redesign's
// "Trade" / "Review order" flow was explicitly requested. It is OFF by default:
// a real broker order is placed only when BOTH a broker access token is present
// AND VANTAGE_ENABLE_EXECUTION="true" are set by the account owner. Otherwise
// every order is a PAPER order — recorded, never sent to a market.
//
// Guardrail: live order placement against a real broker is a regulated activity
// (SEBI). Enabling it is the account owner's explicit decision with their own
// credentials; the shipped demo never fires a live order. Nothing here bypasses
// the pre-trade review the UI puts in front of it.

import { randomUUID } from "node:crypto";

export interface OrderRequest {
  symbol: string;
  side: "buy" | "sell";
  qty: number; // shares (or total lots × lot size for F&O)
  orderType: "market" | "limit";
  price?: number;
  product?: string; // CNC | MIS | NRML
  kind: "equity" | "strategy";
  summary?: string; // human description, e.g. the strategy legs
}

export interface OrderConfirmation {
  id: string;
  status: "paper_filled" | "live_submitted" | "rejected";
  mode: "paper" | "live";
  message: string;
  at: string;
  order: OrderRequest;
}

/** Live execution requires the owner's broker token AND an explicit opt-in flag.
 *  Absent either, orders are paper. */
export function executionEnabled(): boolean {
  return process.env.VANTAGE_ENABLE_EXECUTION === "true" && !!process.env.UPSTOX_ACCESS_TOKEN;
}

export function executionMode(): "live" | "paper" {
  return executionEnabled() ? "live" : "paper";
}

async function placeUpstoxOrder(order: OrderRequest): Promise<OrderConfirmation> {
  // Documented Upstox place-order shape; untested here (no funded account) and
  // reached only when the owner has explicitly enabled execution.
  const token = process.env.UPSTOX_ACCESS_TOKEN!;
  const res = await fetch("https://api.upstox.com/v2/order/place", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      quantity: order.qty,
      product: order.product ?? "D",
      transaction_type: order.side.toUpperCase(),
      order_type: order.orderType === "limit" ? "LIMIT" : "MARKET",
      price: order.orderType === "limit" ? (order.price ?? 0) : 0,
      trading_symbol: order.symbol,
      is_amo: false,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: { order_id?: string }; errors?: unknown };
  if (!res.ok || !body?.data?.order_id) {
    return {
      id: randomUUID(),
      status: "rejected",
      mode: "live",
      message: `Broker rejected the order (${res.status}).`,
      at: new Date().toISOString(),
      order,
    };
  }
  return {
    id: body.data.order_id,
    status: "live_submitted",
    mode: "live",
    message: "Order submitted to your broker.",
    at: new Date().toISOString(),
    order,
  };
}

export async function submitOrder(order: OrderRequest): Promise<OrderConfirmation> {
  if (executionEnabled()) {
    try {
      return await placeUpstoxOrder(order);
    } catch (err) {
      return {
        id: randomUUID(),
        status: "rejected",
        mode: "live",
        message: err instanceof Error ? err.message : "Order failed.",
        at: new Date().toISOString(),
        order,
      };
    }
  }
  return {
    id: randomUUID(),
    status: "paper_filled",
    mode: "paper",
    message: "Paper order — no live broker connected. Recorded for your journal, not sent to any exchange.",
    at: new Date().toISOString(),
    order,
  };
}
