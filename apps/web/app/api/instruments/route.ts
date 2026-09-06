// Full-market instrument search, backed by Upstox's public instrument master
// (every NSE equity + index — no API credentials required). Falls back to the
// seeded demo universe when the dump can't be downloaded.

import { NextRequest, NextResponse } from "next/server";
import { directoryStatus, searchInstruments } from "@/lib/instruments/master";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (q === null) {
    const status = await directoryStatus();
    return NextResponse.json(status);
  }
  if (q.trim().length < 2) return NextResponse.json({ results: [] });

  const results = (await searchInstruments(q, 20)).map((e) => ({
    sym: e.sym,
    name: e.name,
    kind: e.kind,
  }));
  return NextResponse.json({ results });
}
