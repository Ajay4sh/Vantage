// Shared resolver for the module API routes: any symbol in the NSE directory
// becomes a servable Stock. Seeded demo names return their hand-authored
// sample data; everything else gets the deterministic synthesized placeholder
// (sample mode) or a shell the live fetchers overwrite (live mode).

import { resolveInstrument, type DirEntry } from "./instruments/master";
import { SAMPLE_INDICES, SAMPLE_STOCKS } from "./sample-data";
import { synthStock } from "./synth";
import type { Stock } from "./types";

export interface ResolvedStock {
  stock: Stock;
  entry: DirEntry;
  seeded: boolean;
}

export async function stockFor(sym: string): Promise<ResolvedStock | null> {
  const upper = sym.toUpperCase();
  const entry = await resolveInstrument(upper);
  if (!entry) return null;
  const sample = SAMPLE_STOCKS[upper];
  if (sample) return { stock: sample, entry, seeded: true };
  // Headline indices synthesize around their known real levels rather than a
  // random placeholder price.
  const indexSeed = entry.kind === "index" ? SAMPLE_INDICES.find((i) => i.name === entry.sym)?.base : undefined;
  return {
    stock: synthStock({
      sym: entry.sym,
      name: entry.name,
      kind: entry.kind,
      lotSize: entry.lotSize,
      spot: indexSeed,
    }),
    entry,
    seeded: false,
  };
}

/** Parse a ?symbols=A,B,C param: uppercased, deduped, bounded. */
export function parseSymbolsParam(raw: string | null, max = 50): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const sym = part.trim().toUpperCase();
    if (sym && sym.length <= 30) seen.add(sym);
    if (seen.size >= max) break;
  }
  return Array.from(seen);
}
