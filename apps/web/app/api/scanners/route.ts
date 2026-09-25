// Pro redesign — /api/scanners (all). Runs every scanner once over the universe
// and returns each scanner's matches plus a "flagged by 2+ scanners" confluence
// list. One cached computation feeds the whole Scanners landing.

import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { SCANNERS } from "@/lib/scanners";
import { buildUniverse } from "@/lib/scanners/universe";
import type { ScannerId } from "@/lib/scanners/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await cached("scanner:all:v1", 90, async () => {
    const universe = buildUniverse();
    const perScanner: Record<string, { label: string; description: string; matches: ReturnType<(typeof SCANNERS)[ScannerId]["run"]> }> = {};
    // symbol -> { chgPct, tags[] }
    const conf = new Map<string, { chgPct: number; tags: string[] }>();

    for (const id of Object.keys(SCANNERS) as ScannerId[]) {
      const def = SCANNERS[id];
      const matches = def.run(universe);
      perScanner[id] = { label: def.label, description: def.description, matches };
      for (const m of matches) {
        const e = conf.get(m.sym) ?? { chgPct: m.chgPct, tags: [] };
        if (!e.tags.includes(def.label)) e.tags.push(def.label);
        conf.set(m.sym, e);
      }
    }

    const confluence = Array.from(conf.entries())
      .filter(([, v]) => v.tags.length >= 2)
      .map(([sym, v]) => ({ sym, chgPct: v.chgPct, tags: v.tags }))
      .sort((a, b) => b.tags.length - a.tags.length)
      .slice(0, 10);

    return { perScanner, confluence };
  });

  return NextResponse.json(payload);
}
