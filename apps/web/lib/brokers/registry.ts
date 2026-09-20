// Phase 10.2 — broker registry. The one place the app resolves a BrokerAdapter.
// Everything else asks the registry, never a specific broker module — so adding
// or removing a broker is a single edit here.
//
// m.Stock and Sahi are deliberately absent (Phase 10.5): neither is confirmed to
// expose a documented public API for third-party read access. Building an adapter
// against an undocumented surface is out of guardrails — that's a
// partnership/API-access conversation, not an engineering task. Add them here
// only once a documented API is confirmed.

import { upstoxAdapter } from "./upstox/adapter";
import { aliceBlueAdapter } from "./aliceblue/adapter";
import { kotakAdapter } from "./kotak/adapter";
import type { BrokerAdapter, BrokerId } from "./types";

const ADAPTERS: Record<BrokerId, BrokerAdapter> = {
  upstox: upstoxAdapter,
  aliceblue: aliceBlueAdapter,
  kotak: kotakAdapter,
};

export function getAdapter(id: BrokerId): BrokerAdapter {
  return ADAPTERS[id];
}

export function listAdapters(): BrokerAdapter[] {
  return Object.values(ADAPTERS);
}

/** Brokers whose credentials are actually present in this environment. */
export function configuredAdapters(): BrokerAdapter[] {
  return listAdapters().filter((a) => a.configured());
}

/** The adapter to use by default: an explicit VANTAGE_BROKER override if it's
 *  configured, else the first configured broker, else Upstox (the reference
 *  adapter, which stays dormant until a token exists). */
export function defaultAdapter(): BrokerAdapter {
  const pref = process.env.VANTAGE_BROKER as BrokerId | undefined;
  if (pref && ADAPTERS[pref]?.configured()) return ADAPTERS[pref];
  return configuredAdapters()[0] ?? upstoxAdapter;
}

export function anyBrokerConfigured(): boolean {
  return configuredAdapters().length > 0;
}
