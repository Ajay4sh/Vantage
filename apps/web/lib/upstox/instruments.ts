// Upstox instrument keys for the symbols the terminal covers.
// NSE equities are keyed by ISIN: "NSE_EQ|<ISIN>".
// Verify against Upstox's instrument master before trusting these in prod:
// https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz

export const EQUITY_INSTRUMENTS: Record<string, string> = {
  BPCL: "NSE_EQ|INE029A01011",
  RELIANCE: "NSE_EQ|INE002A01018",
  TCS: "NSE_EQ|INE467B01029",
  HDFCBANK: "NSE_EQ|INE040A01034",
  INFY: "NSE_EQ|INE009A01021",
  ITC: "NSE_EQ|INE154A01025",
};

// USD/INR and Brent from the demo strip aren't served by Upstox's equity
// segments — the live strip carries the three indices below only.
export const INDEX_INSTRUMENTS: Record<string, string> = {
  "NIFTY 50": "NSE_INDEX|Nifty 50",
  SENSEX: "BSE_INDEX|SENSEX",
  "BANK NIFTY": "NSE_INDEX|Nifty Bank",
};

export function symbolForInstrument(instrumentKey: string): string | null {
  for (const [sym, key] of Object.entries(EQUITY_INSTRUMENTS)) {
    if (key === instrumentKey) return sym;
  }
  return null;
}

export function indexNameForInstrument(instrumentKey: string): string | null {
  for (const [name, key] of Object.entries(INDEX_INSTRUMENTS)) {
    if (key === instrumentKey) return name;
  }
  return null;
}
