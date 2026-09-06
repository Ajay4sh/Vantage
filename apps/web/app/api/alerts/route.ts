// Phase 8.2 — CRUD for a user's price/event alerts. Auth-gated: alerts are a
// saved, per-user feature (anonymous users can still browse everything else).

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { describeAlert } from "@/lib/alerts-eval";
import { createAlert, deleteAlert, listAlerts, type AlertCondition } from "@/lib/store";
import { stockFor } from "@/lib/stock-source";

export const dynamic = "force-dynamic";

const CONDITIONS: AlertCondition[] = [
  "price_above",
  "price_below",
  "cross_support",
  "cross_resistance",
  "iv_spike",
  "52w_high",
  "52w_low",
  "pcr_shift",
];

const NEEDS_THRESHOLD: AlertCondition[] = ["price_above", "price_below", "iv_spike", "pcr_shift"];

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const alerts = (await listAlerts(user.id)).map((a) => ({ ...a, label: describeAlert(a) }));
  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    symbol?: string;
    conditionType?: AlertCondition;
    threshold?: number | null;
  } | null;

  const symbol = body?.symbol?.toUpperCase();
  const conditionType = body?.conditionType;
  if (!symbol || !conditionType || !CONDITIONS.includes(conditionType)) {
    return NextResponse.json({ error: "Pick a symbol and a valid condition." }, { status: 400 });
  }
  const resolved = await stockFor(symbol);
  if (!resolved) return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 404 });

  let threshold: number | null = null;
  if (NEEDS_THRESHOLD.includes(conditionType)) {
    const n = Number(body?.threshold);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "This condition needs a numeric value." }, { status: 400 });
    }
    threshold = n;
  }

  const alert = await createAlert({ userId: user.id, symbol, conditionType, threshold, note: null });
  return NextResponse.json({ alert: { ...alert, label: describeAlert(alert) } });
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  return NextResponse.json({ deleted: await deleteAlert(user.id, id) });
}
