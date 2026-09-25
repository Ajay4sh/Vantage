// Phase 12 (Gap 2) — /api/scanners/[type]. Runs one scanner over the universe
// and returns matches, cached with a short TTL so it feels near-real-time
// without recomputing the whole universe on every request. Analysis only.

import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { isScannerId, SCANNERS } from "@/lib/scanners";
import { buildUniverse } from "@/lib/scanners/universe";

export const dynamic = "force-dynamic";

const TTL_SECONDS = 90; // "real-time" feel without wasteful recompute

export async function GET(_req: NextRequest, { params }: { params: { type: string } }) {
  const type = params.type;
  if (!isScannerId(type)) {
    return NextResponse.json({ error: `Unknown scanner: ${type}` }, { status: 404 });
  }
  const def = SCANNERS[type];
  const matches = await cached(`scanner:v1:${type}`, TTL_SECONDS, async () => def.run(buildUniverse()));
  return NextResponse.json({ type, label: def.label, description: def.description, count: matches.length, matches });
}
