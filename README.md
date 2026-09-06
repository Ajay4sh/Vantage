# Vantage — Indian equity research terminal

Personal/shareable research terminal covering four modules — fundamentals,
technicals, F&O/options analytics, and news sentiment — plus an auto-generated
research-note synthesis. Research and analytics only: not a brokerage, not an
order-execution platform.

Built per `CLAUDE_CODE_BUILD_INSTRUCTIONS.md`; the visual language, layout,
and the conviction/implied-move/research-note logic are ported from the
static demo (`index.html` / `data.js` / `app.js`).

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind, Chart.js
- **Backend**: Next.js API routes (broker APIs need server-side auth — CORS +
  credential exposure rule out direct browser calls)
- **Data**: Upstox Developer API (primary, all four modules on one auth flow)
- **Cache**: Upstash Redis (REST) with in-memory fallback for local dev
- **DB**: Postgres (Phase 5, note persistence) — not wired yet

## Getting started

```bash
npm install
npm run dev        # http://localhost:3100
npm test           # unit tests: indicators, conviction port, response parsers
```

The app is pinned to port **3100** (in `apps/web/package.json`) because port
3000 is taken by another local project.

With no Upstox credentials the terminal runs on a **server-side simulated
feed** (random walk seeded from sample data) and shows a persistent
"SIMULATED LIVE" badge — it is never ambiguous whether data is real.

### Going live (Phase 1)

1. Get Upstox Developer API credentials (requires a funded Upstox account —
   verify current pricing/free-tier terms at upstox.com/developer first).
2. `cp .env.local.example apps/web/.env.local` and fill in
   `UPSTOX_API_KEY` / `UPSTOX_API_SECRET`.
3. `npm run refresh-token` — prints the login URL; after logging in, run
   `npm run refresh-token -- <code>` and paste the printed
   `UPSTOX_ACCESS_TOKEN` into `.env.local`. The standard token expires daily;
   an analytics token (`UPSTOX_ANALYTICS_TOKEN`) is one-time but read-only.
4. Restart the dev server — `/api/quotes` now proxies Upstox Market Quote
   (5s cache TTL) and the sim badge disappears in favour of the real
   market-hours pill.

## Universe

The watchlist is dynamic: search covers the **entire NSE directory (~2,500
equities + indices)**, ingested from Upstox's public instrument master
(`assets.upstox.com`, no credentials needed, refreshed daily, seeded-six
fallback when offline). Searched instruments join a persisted watchlist
(localStorage). Indices are first-class: no fundamentals, weekly option
expiries (Nifty/Bank Nifty), same technicals/options analytics.

Without Upstox credentials, non-seeded instruments carry **synthesized
placeholder data** — a deterministic random walk with real math on top
(RSI, max pain, greeks all computed by the live engines) and *no fabricated
narratives* (no fake news or fundamentals; those show "—"/empty until live).
The SIMULATED LIVE badge stays on throughout.

## Phase status

- [x] **Phase 1 — Skeleton + quotes**: demo ported to React components,
  `/api/quotes` with Upstox client + Redis cache + simulated fallback, daily
  token-refresh script. WebSocket feed upgrade pending real credentials.
- [x] **Phase 2 — Technicals + fundamentals**: `/api/technicals` computes
  RSI/MACD/trend/support-resistance server-side from Historical Candle v3
  (1h cache); `/api/fundamentals` condenses key-ratios + income statement
  (24h cache). Sample fallback without a token; live paths untested against
  the real API until credentials exist. D/E and dividend yield have no
  Upstox source and render as "—" in live mode (screener.in fallback is the
  §2 option). Run `npm test` for the indicator/parser/options-math suite.
- [x] **Phase 3 — Options analytics**: `/api/options` computes PCR, max pain
  (writers'-payout argmin), OI walls, Black-Scholes greeks, 20-day realized
  vol, IV-vs-RV premium, and OTM put/call skew server-side (`lib/options.ts`),
  emitting discrete signals (Positioning / Volatility pricing / Max pain /
  IV skew) plus a universe-wide F&O radar (`?radar=1`) ranked by positioning
  strength. Live mode uses real per-strike chain IV; sample mode synthesizes
  a smile around the demo's flat IV. Signals describe market positioning —
  they are analytics, never trade advice (see §Compliance).
- [x] **Phase 4 — News + sentiment**: `/api/news` pulls headlines (NewsAPI.org
  behind `NEWSAPI_KEY`) and tags each — Claude when `ANTHROPIC_API_KEY` is set
  (`lib/sentiment.ts`, model via `ANTHROPIC_MODEL`, default `claude-opus-5`),
  a transparent keyword heuristic otherwise so the demo still tags. Cached 3h
  per ticker; sample headlines for the seeded six, empty for un-seeded names
  (headlines are never synthesized). Live sources env-gated + untested against
  the real APIs. (Upstox News API is the intended primary source per §2 — TODO
  once verifiable against a live response.)
- [x] **Phase 5 — Persistence**: user accounts, prefs (mode/locale/watchlist),
  alerts, and saved notes persist to Postgres when `DATABASE_URL` is set
  (`lib/store-pg.ts` + `lib/db/`), else the in-memory fallback (non-durable).
  The store is async end-to-end; the Postgres SQL is verified against a real
  in-process Postgres (PGlite) in `tests/store-pg.test.ts`. Schema:
  `db/schema.sql` / `lib/db/schema.ts`. OTPs stay in-memory (ephemeral).
- [x] **Phase 9 — Risk-aware F&O tooling**: a risk *layer* on top of the
  Options tab (new **Risk** tab), not a restyle of it. (1) `<PreTradeRiskGate>`
  — an interstitial before any paper position showing max loss in ₹, % of
  stated capital, breakeven, and the reused implied-move band, with a separate
  heavier acknowledgment for undefined-risk (naked short) legs. (2) Embedded
  position sizing (`capital × risk% ÷ per-contract premium`, default 2%) shown
  as "you're entering N× the budgeted size". (3) Personal **loss-pattern
  mirror** — a private self-logged `trade_log` (win rate, P&L by strategy and
  expiry proximity) set against SEBI's published findings; never a leaderboard,
  never shared, sign-in required. (4) Expiry-day reflection nudge (a question,
  never a block) referencing the user's own expiry-day history or the SEBI
  finding. (5) Plain-language defined-risk strategy education (covered call,
  credit spread…), linked contextually from the gate. Math is pure and
  unit-tested (`lib/risk.ts`, `tests/risk.test.ts`); capital/risk-budget persist
  via prefs, the journal via the `trade_log` table (verified with PGlite). No
  feature adds trading frequency, reward visuals, or push-to-trade — friction by
  design (Phase 9 guardrails). 99 vitest tests.
- [ ] Phase 6 — Sharing & accounts (only if multi-user is actually needed)
- [x] **Phase 7 — Accessibility & accounts**: (7.1) phone-OTP auth — custom
  JWT session in an httpOnly cookie, MSG91 for SMS with a dev-code fallback so
  login works without a gateway; anonymous browsing stays open. (7.2) "Explain
  this" tooltips — `<MetricTooltip>` + `lib/glossary.ts` across every metric
  label. (7.3) Simple/Pro mode toggle — reduced per-stock view with a plain-
  language take derived from conviction + valuationNote, persisted (localStorage
  anon, DB when signed in); disclaimer shown in both modes.
- [x] **Phase 8 — Growth**: (8.1) PWA (manifest, app-shell service worker,
  add-to-home-screen prompt) + a genuine mobile layout below 640px (stacked
  cards, bottom tab bar, watchlist bottom sheet; Simple mode default on first
  mobile visit). (8.2) price/event alerts — `alerts` table (schema in
  `db/schema.sql`), pure evaluator (`lib/alerts-eval.ts`, unit-tested),
  market-hours-gated cron (`/api/cron/evaluate-alerts`, `vercel.json`), in-app
  notification center + bell badge, FCM web-push behind env. (8.3) Hindi
  localization — key-based i18n (`lib/i18n`), locale toggle, Noto Sans
  Devanagari applied only when `lang=hi`, localized chrome + research-note
  labels; tickers/numbers/abbreviations (P/E, RSI…) stay in English. The
  glossary definitions are intentionally left in English for now.

- [x] **Market Pulse — mobile front door** (from `Mobile growth onramp
  design/`): a sentiment-led on-ramp before the dense terminal. `lib/pulse.ts`
  computes market + six sector moods honestly (index move anchored, conviction
  breadth as tiebreak — calm days render neutral, never exaggerated) and an
  editorial "today's story" that describes, never predicts. `/api/pulse` serves
  the snapshot (30s cache; Auto/Pharma via synth so all six cards are real).
  Mobile gains an app-level 4-tab nav (Pulse / Markets / Watchlist / Profile,
  `components/pulse/`): mood hero with weather icons + tide wave, story card,
  scrollable sector row → 2-column grid, swipeable "build your first watchlist"
  onboarding deck (drag/tap, adds to the real watchlist), an exportable mood
  snapshot (9:16 + 1:1 via self-contained SVG → PNG / Web Share), and the
  Pulse → Simple cross-fade transition (Pro never preselected arriving from
  Pulse). Pulse is the mobile default; desktop keeps the Pro terminal untouched.

Auth/alerts run on the same in-memory store as the rest until `DATABASE_URL`
is set; SMS, push, and the cron secret are all env-gated with graceful demo
fallbacks (same pattern as the Upstox integration).

## Compliance

A pure data/analytics display (prices, ratios, OI, sentiment tags) without
issuing directional calls does not trigger SEBI Research Analyst Regulations.
The conviction score stays framed as "a composite of signals," never buy/sell
advice, and every research note carries the disclaimer: *Not investment
advice. Not SEBI-registered research.* Revisit this before building any
sharing/multi-user phase.
