// Plain-language definitions for every metric the terminal shows. One source
// of truth for the "Explain this" tooltip layer (7.2). Keep entries to 1-2
// jargon-light sentences a first-time investor can follow. Add a key here and
// wrap the label with <MetricTooltip term="..."> — that's the whole extension
// path.

export interface GlossaryEntry {
  title: string;
  body: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  // Fundamentals
  pe_ratio: {
    title: "P/E ratio",
    body: "Price-to-earnings: the share price divided by earnings per share. Roughly, how many rupees you pay for ₹1 of yearly profit — lower can mean cheaper, but compare within the same industry.",
  },
  roe: {
    title: "ROE (Return on Equity)",
    body: "How much profit the company generates from shareholders' money, as a yearly percentage. Higher is generally better; above ~15% is considered strong.",
  },
  debt_equity: {
    title: "Debt-to-equity",
    body: "How much the company borrows versus what shareholders own. Higher means more leverage and more risk if business slows.",
  },
  eps: {
    title: "EPS (Earnings Per Share)",
    body: "The company's yearly profit divided by its number of shares — the profit attributable to one share.",
  },
  revenue_growth: {
    title: "Revenue growth (YoY)",
    body: "How much sales grew versus the same period last year. Positive and rising is a sign of a healthy, expanding business.",
  },
  dividend_yield: {
    title: "Dividend yield",
    body: "The yearly dividend paid out as a percentage of the share price — the cash return you get just for holding, before any price change.",
  },
  operating_margin: {
    title: "Operating margin",
    body: "Profit from core operations as a percentage of sales, before interest and tax. Shows how efficiently the business runs.",
  },
  net_margin: {
    title: "Net margin",
    body: "Final profit as a percentage of sales, after all costs, interest, and tax. What the company actually keeps from every rupee of revenue.",
  },
  market_cap: {
    title: "Market capitalisation",
    body: "The total value of all the company's shares — share price times number of shares. A rough size measure.",
  },
  week52: {
    title: "52-week range",
    body: "The lowest and highest the share has traded over the past year. Shows where today's price sits within its recent history.",
  },

  // Technicals
  rsi: {
    title: "RSI (Relative Strength Index)",
    body: "A momentum gauge from 0–100. Above 70 often means the stock is 'overbought' (may cool off); below 30 means 'oversold' (may bounce). Around 50 is neutral.",
  },
  macd: {
    title: "MACD",
    body: "A trend-and-momentum indicator built from two moving averages. Above its signal line suggests upward momentum; below suggests downward. It's a directional hint, not a guarantee.",
  },
  trend: {
    title: "Trend",
    body: "The general direction of price over recent sessions — up, down, or sideways — read from moving averages.",
  },
  support: {
    title: "Support level",
    body: "A price zone where buying has repeatedly appeared, tending to slow or stop falls. It can break if selling is strong enough.",
  },
  resistance: {
    title: "Resistance level",
    body: "A price zone where selling has repeatedly appeared, tending to cap rises. A clear break above can signal further upside.",
  },

  // Options
  iv: {
    title: "IV (Implied Volatility)",
    body: "The amount of movement the options market is pricing in for the future, as an annualised percentage. Higher IV means pricier options and bigger expected swings.",
  },
  pcr: {
    title: "PCR (Put/Call Ratio)",
    body: "Total put open interest divided by call open interest. Above 1 leans bullish by convention (more puts being written as floors); below 1 leans bearish. A positioning read, not a prediction.",
  },
  max_pain: {
    title: "Max pain",
    body: "The expiry price at which option buyers lose the most in aggregate — where the stock is theoretically 'pulled' by option writers. The pull is weak and mostly matters in expiry week.",
  },
  lot_size: {
    title: "Lot size",
    body: "The fixed number of shares in one futures/options contract for this stock. You trade in multiples of this, not single shares.",
  },
  implied_move: {
    title: "Implied move",
    body: "The price range the options market is pricing in by expiry, from current IV. The ±1 SD band has roughly a 68% chance of containing the price — a probability band, not a forecast of direction.",
  },
  oi: {
    title: "Open interest (OI)",
    body: "The number of option contracts currently outstanding at a strike. Big build-ups mark strikes where a lot of positioning sits — informal support (puts) or resistance (calls).",
  },
  realized_vol: {
    title: "Realized volatility",
    body: "How much the stock has actually moved recently (last ~20 sessions), annualised. Compared against IV, it tells you whether options look expensive or cheap.",
  },
  iv_premium: {
    title: "IV premium",
    body: "How much implied volatility sits above (or below) recent realized volatility. A big positive premium means options are pricing in more movement than the stock has delivered — 'rich'.",
  },
  iv_skew: {
    title: "IV skew",
    body: "The gap between the implied volatility of downside puts and upside calls. Puts pricier than calls (put-skew) means the market is paying up for downside protection.",
  },
  delta: {
    title: "Delta",
    body: "How much an option's price moves for a ₹1 move in the stock. A 0.50 delta call gains about ₹0.50 if the stock rises ₹1. Also a rough gauge of the odds of finishing in-the-money.",
  },
  gamma: {
    title: "Gamma",
    body: "How fast delta itself changes as the stock moves. High gamma (near the money, near expiry) means the option's sensitivity shifts quickly.",
  },
  theta: {
    title: "Theta (time decay)",
    body: "How much value an option loses each day just from time passing, all else equal. It works against option buyers and for sellers.",
  },
  vega: {
    title: "Vega",
    body: "How much an option's price moves for a 1-point change in implied volatility. Options are worth more when expected movement (IV) rises.",
  },

  // Risk (Phase 9)
  max_loss: {
    title: "Maximum loss",
    body: "The most this position can lose. For a bought option it's the premium you paid. For a sold (naked) option it can be far larger — for a short call, theoretically unlimited — which is why it's flagged separately.",
  },
  breakeven: {
    title: "Breakeven",
    body: "The stock price at which the position neither makes nor loses money at expiry. For a long call it's the strike plus the premium paid; for a long put, the strike minus the premium.",
  },
  position_sizing: {
    title: "Position sizing",
    body: "Choosing how many contracts to trade so that the worst case stays within a set slice of your capital — a risk budget. Sizing to a fixed percentage is the single most common risk discipline.",
  },
  risk_budget: {
    title: "Risk budget",
    body: "The share of your trading capital you're willing to lose on one position, as a percentage. A common starting point is 2%: on ₹1,00,000 that's ₹2,000 of risk per trade.",
  },
  defined_risk: {
    title: "Defined risk",
    body: "A position whose maximum loss is known and capped before you enter — like buying an option, or a spread. The opposite is undefined risk (a naked short), where a large move can cost far more than planned.",
  },
  capital_at_risk: {
    title: "Capital at risk",
    body: "This position's maximum loss expressed as a percentage of your stated trading capital — the number that tells you whether one bad trade is a scratch or a serious dent.",
  },

  // Composite
  conviction: {
    title: "Conviction score",
    body: "A transparent composite of four signals — fundamentals, technicals, options positioning, and news — on a −100 to +100 scale. It summarises the signals in one number; it is not buy/sell advice.",
  },
};

export function glossary(term: string): GlossaryEntry | null {
  return GLOSSARY[term] ?? null;
}
