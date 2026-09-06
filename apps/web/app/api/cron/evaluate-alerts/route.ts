// Phase 8.2 — background alert evaluation. Wired to Vercel Cron (see
// vercel.json) to run every few minutes; it self-limits to NSE market hours so
// it isn't doing work 24/7. Evaluates each active alert against the current
// (cached) quote and marks triggers, then pushes web notifications where a
// device token exists — the in-app notification center is the fallback.
//
// Protected by CRON_SECRET: Vercel Cron sends it as a Bearer token. A local
// `?force=1` bypasses the market-hours gate for testing when not in production.

import { NextRequest, NextResponse } from "next/server";
import { contextFromStock, describeAlert, evaluateAlert } from "@/lib/alerts-eval";
import { sendPush } from "@/lib/push";
import { simulatedSnapshot } from "@/lib/simulation";
import { listActiveAlerts, markAlertTriggered } from "@/lib/store";
import { stockFor } from "@/lib/stock-source";
import { fetchLiveQuotes } from "@/lib/upstox/client";
import { marketDataToken } from "@/lib/upstox/token";

export const dynamic = "force-dynamic";

function isMarketOpenIST(): boolean {
  const istMs = Date.now() + (new Date().getTimezoneOffset() + 330) * 60000;
  const ist = new Date(istMs);
  const day = ist.getUTCDay();
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return day >= 1 && day <= 5 && minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

export async function GET(req: NextRequest) {
  // Auth: require the cron secret when one is configured.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const force = req.nextUrl.searchParams.get("force") === "1" && process.env.NODE_ENV !== "production";
  if (!force && !isMarketOpenIST()) {
    return NextResponse.json({ skipped: "market closed", evaluated: 0, triggered: 0 });
  }

  const active = await listActiveAlerts();
  if (active.length === 0) return NextResponse.json({ evaluated: 0, triggered: 0 });

  // Current prices for the symbols under watch.
  const symbols = Array.from(new Set(active.map((a) => a.symbol)));
  const priceMap = new Map<string, number>();
  try {
    if (marketDataToken()) {
      const eq: Record<string, string> = {};
      for (const sym of symbols) {
        const r = await stockFor(sym);
        if (r && r.entry.kind === "equity") eq[sym] = r.entry.key;
      }
      const live = await fetchLiveQuotes(eq);
      for (const [sym, q] of Object.entries(live.quotes)) priceMap.set(sym, q.price);
    } else {
      const snap = simulatedSnapshot(symbols);
      for (const [sym, q] of Object.entries(snap.quotes)) priceMap.set(sym, q.price);
    }
  } catch (err) {
    console.error("alert eval: price fetch failed", err);
  }

  const triggered: { id: string; label: string; value: number }[] = [];
  for (const alert of active) {
    const resolved = await stockFor(alert.symbol);
    if (!resolved) continue;
    const ctx = contextFromStock(resolved.stock, priceMap.get(alert.symbol));
    const result = evaluateAlert(alert, ctx);
    if (result.triggered) {
      await markAlertTriggered(alert.id, result.value);
      const label = describeAlert(alert);
      triggered.push({ id: alert.id, label, value: result.value });
      // Best-effort push; no-op without FCM config (in-app center covers it).
      await sendPush([], "Vantage alert", label);
    }
  }

  return NextResponse.json({ evaluated: active.length, triggered: triggered.length, fired: triggered });
}
