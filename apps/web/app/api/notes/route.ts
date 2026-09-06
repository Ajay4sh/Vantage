// Phase 5 — research notes. GET returns a signed-in user's saved notes (all,
// or ?symbol=…). POST generates a note from the shared conviction logic and,
// when signed in, persists it so past notes for a ticker can be recalled.
// Anonymous users still get a generated note back; it just isn't saved.

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { generateNote } from "@/lib/conviction";
import { SAMPLE_STOCKS } from "@/lib/sample-data";
import { stockFor } from "@/lib/stock-source";
import { listNotes, saveNote } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ notes: [] });
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase() || undefined;
  return NextResponse.json({ notes: await listNotes(user.id, symbol) });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { symbol?: string } | null;
  const symbol = body?.symbol?.toUpperCase() ?? "";
  // Prefer the seeded stock (rich note); fall back to any resolvable instrument.
  const stock = SAMPLE_STOCKS[symbol] ?? (await stockFor(symbol))?.stock;
  if (!stock) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 404 });
  }

  const note = generateNote(stock);
  const user = await currentUser();
  if (user) {
    const saved = await saveNote(user.id, symbol, note);
    return NextResponse.json({ symbol, note, persisted: true, id: saved.id });
  }
  return NextResponse.json({ symbol, note, persisted: false });
}
