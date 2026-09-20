"use client";

// Main terminal orchestrator. State model is a direct port of the demo's
// app.js, with two structural changes:
//  1. The client-side setInterval random walk is gone — prices arrive by
//     polling /api/quotes (Upstox when a token is configured, server-side
//     simulation otherwise).
//  2. The universe is dynamic: the watchlist is a persisted symbol list
//     (localStorage), seeded with the demo six; any instrument found via
//     full-market search gets a Stock shell from /api/stocks and joins the
//     same render path.

import { useCallback, useEffect, useRef, useState } from "react";
import TopBar from "./TopBar";
import Watchlist from "./Watchlist";
import SimpleView from "./SimpleView";
import { useApp } from "./AppProvider";
import StockHeader from "./StockHeader";
import ConvictionGauge from "./ConvictionGauge";
import ResearchNote from "./ResearchNote";
import Overview from "./tabs/Overview";
import Fundamentals from "./tabs/Fundamentals";
import Technicals from "./tabs/Technicals";
import Options from "./tabs/Options";
import Risk from "./tabs/Risk";
import Portfolio from "./tabs/Portfolio";
import News from "./tabs/News";
import PulseHome from "./pulse/PulseHome";
import SimpleWatchlist from "./pulse/SimpleWatchlist";
import ProfileSurface from "./pulse/ProfileSurface";
import PulseTransition from "./pulse/PulseTransition";
import MobileNav, { type Surface } from "./pulse/MobileNav";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useT } from "@/lib/i18n/react";
import { DEFAULT_SYMBOL, SAMPLE_STOCKS, SECTORS } from "@/lib/sample-data";
import type {
  Fundamentals as FundamentalsData,
  IndexQuote,
  OptionsAnalytics,
  OptionsData,
  QuoteSource,
  QuotesResponse,
  Stock,
  Technicals as TechnicalsData,
} from "@/lib/types";

const POLL_MS = 3000; // same cadence class as the demo's TICK_MS
const WATCHLIST_KEY = "vantage:watchlist:v1";

const TABS = [
  ["overview", "Overview"],
  ["fundamentals", "Fundamentals"],
  ["technicals", "Technicals"],
  ["options", "Options"],
  ["risk", "Risk"],
  ["portfolio", "Portfolio"],
  ["news", "News & sentiment"],
] as const;

type TabId = (typeof TABS)[number][0];

function cloneSampleStocks(): Record<string, Stock> {
  return JSON.parse(JSON.stringify(SAMPLE_STOCKS)) as Record<string, Stock>;
}

/** Merge a quotes payload into stock state: update price/chg, roll the
 *  sparkline (last 10) and price history (last 20) windows, apply OI nudges
 *  when the (simulated) feed provides them. */
function applyQuotes(prev: Record<string, Stock>, data: QuotesResponse): Record<string, Stock> {
  const next: Record<string, Stock> = {};
  for (const [sym, s] of Object.entries(prev)) {
    const q = data.quotes[sym];
    if (!q) {
      next[sym] = s;
      continue;
    }
    next[sym] = {
      ...s,
      price: q.price,
      chg: q.chg,
      chgPct: q.chgPct,
      spark: [...s.spark.slice(1), q.price],
      technicals: {
        ...s.technicals,
        priceHistory: [...s.technicals.priceHistory.slice(1), q.price],
      },
      options: q.options
        ? { ...s.options, callOI: q.options.callOI, putOI: q.options.putOI, pcr: q.options.pcr }
        : s.options,
    };
  }
  return next;
}

export default function Terminal() {
  const { mode, setMode } = useApp();
  const t = useT();
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileSurface, setMobileSurface] = useState<Surface>("pulse");
  const [pulseKey, setPulseKey] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  // Tapping the Pulse tab always returns to the Pulse root (remount), matching
  // the standard "tap active tab → home" mobile pattern.
  const goToSurface = useCallback((s: Surface) => {
    if (s === "pulse") setPulseKey((k) => k + 1);
    setMobileSurface(s);
  }, []);
  const [stocks, setStocks] = useState<Record<string, Stock>>(cloneSampleStocks);
  const [watchlist, setWatchlist] = useState<string[]>(() => Object.keys(SAMPLE_STOCKS));
  const [indices, setIndices] = useState<IndexQuote[]>([]);
  const [source, setSource] = useState<QuoteSource | null>(null);
  const [currentSymbol, setCurrentSymbol] = useState(DEFAULT_SYMBOL);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [liveOn, setLiveOn] = useState(true);
  const [lastTickAt, setLastTickAt] = useState(() => Date.now());
  const [analytics, setAnalytics] = useState<Record<string, OptionsAnalytics>>({});

  const pollInFlight = useRef(false);
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;

  /** Make sure a Stock shell exists for a symbol; fetches one for non-seeded
   *  instruments. Returns success. */
  const ensureStock = useCallback(async (sym: string): Promise<boolean> => {
    let exists = false;
    setStocks((prev) => {
      exists = !!prev[sym];
      return prev;
    });
    if (exists) return true;
    try {
      const res = await fetch(`/api/stocks?symbol=${encodeURIComponent(sym)}`, { cache: "no-store" });
      if (!res.ok) return false;
      const data = (await res.json()) as { stock: Stock };
      setStocks((prev) => (prev[sym] ? prev : { ...prev, [sym]: data.stock }));
      return true;
    } catch {
      return false;
    }
  }, []);

  // Restore the persisted watchlist once on mount, hydrating shells for any
  // non-seeded symbols.
  useEffect(() => {
    let saved: string[] | null = null;
    try {
      const raw = window.localStorage.getItem(WATCHLIST_KEY);
      if (raw) saved = (JSON.parse(raw) as string[]).filter((s) => typeof s === "string");
    } catch {
      /* corrupted storage — start fresh */
    }
    if (!saved || saved.length === 0) return;
    (async () => {
      const ok: string[] = [];
      for (const sym of saved) {
        if (await ensureStock(sym)) ok.push(sym);
      }
      if (ok.length > 0) {
        setWatchlist(ok);
        if (!ok.includes(DEFAULT_SYMBOL)) setCurrentSymbol(ok[0]);
      }
    })();
  }, [ensureStock]);

  // Persist watchlist changes.
  useEffect(() => {
    try {
      window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    } catch {
      /* storage full/blocked — non-fatal */
    }
  }, [watchlist]);

  const poll = useCallback(async () => {
    if (pollInFlight.current) return;
    pollInFlight.current = true;
    try {
      const syms = watchlistRef.current.join(",");
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(syms)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`quotes ${res.status}`);
      const data = (await res.json()) as QuotesResponse;
      setStocks((prev) => applyQuotes(prev, data));
      setIndices(data.indices);
      setSource(data.source);
      setLastTickAt(Date.now());
    } catch (err) {
      // Keep rendering the last snapshot; next poll retries.
      console.error("quote poll failed", err);
    } finally {
      pollInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!liveOn) return;
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [liveOn, poll]);

  // Refresh technicals + fundamentals + options analytics from their module
  // endpoints on symbol selection. Analytics are always merged (sample
  // analytics are computed, not seeded); module data merges only when live,
  // since a sample response equals the seeded state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tRes, fRes, oRes] = await Promise.all([
          fetch(`/api/technicals?symbol=${currentSymbol}`, { cache: "no-store" }),
          fetch(`/api/fundamentals?symbol=${currentSymbol}`, { cache: "no-store" }),
          fetch(`/api/options?symbol=${currentSymbol}`, { cache: "no-store" }),
        ]);
        const t = tRes.ok
          ? ((await tRes.json()) as { source: string; technicals: TechnicalsData })
          : null;
        const f = fRes.ok
          ? ((await fRes.json()) as { source: string; fundamentals: FundamentalsData })
          : null;
        const o = oRes.ok
          ? ((await oRes.json()) as { source: string; options: OptionsData; analytics: OptionsAnalytics })
          : null;
        if (cancelled) return;
        if (o?.analytics) setAnalytics((prev) => ({ ...prev, [currentSymbol]: o.analytics }));
        setStocks((prev) => {
          const s = prev[currentSymbol];
          if (!s) return prev;
          let merged = s;
          if (t?.source === "live" && t.technicals) merged = { ...merged, technicals: t.technicals };
          if (f?.source === "live" && f.fundamentals) merged = { ...merged, fundamentals: f.fundamentals };
          if (o?.source === "live" && o.options) merged = { ...merged, options: o.options };
          return merged === s ? prev : { ...prev, [currentSymbol]: merged };
        });
      } catch (err) {
        console.error("module data fetch failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentSymbol]);

  const addSymbol = useCallback(
    async (sym: string) => {
      const upper = sym.toUpperCase();
      if (!(await ensureStock(upper))) {
        console.error(`could not load instrument ${upper}`);
        return;
      }
      setWatchlist((prev) => (prev.includes(upper) ? prev : [...prev, upper]));
      setCurrentSymbol(upper);
      setQuery("");
    },
    [ensureStock],
  );

  const removeSymbol = useCallback(
    (sym: string) => {
      setWatchlist((prev) => {
        if (prev.length <= 1) return prev; // never empty the terminal
        const next = prev.filter((s) => s !== sym);
        if (sym === currentSymbol) setCurrentSymbol(next[0]);
        return next;
      });
    },
    [currentSymbol],
  );

  const current = stocks[currentSymbol] ?? Object.values(stocks)[0];
  const rows = watchlist.map((sym) => stocks[sym]).filter((s): s is Stock => !!s);

  const watchlistEl = (
    <Watchlist
      stocks={rows}
      sectors={SECTORS}
      filter={filter}
      query={query}
      currentSymbol={currentSymbol}
      onFilter={setFilter}
      onQuery={setQuery}
      onSelect={(sym) => {
        setCurrentSymbol(sym);
        setMobileSheetOpen(false);
      }}
      onAdd={(sym) => {
        addSymbol(sym);
        setMobileSheetOpen(false);
      }}
      onRemove={watchlist.length > 1 ? removeSymbol : undefined}
    />
  );

  const activePanel = (
    <>
      {activeTab === "overview" && <Overview stock={current} />}
      {activeTab === "fundamentals" && <Fundamentals stock={current} />}
      {activeTab === "technicals" && <Technicals stock={current} />}
      {activeTab === "options" && (
        <Options stock={current} analytics={analytics[current.sym]} onSelect={setCurrentSymbol} radarSymbols={watchlist} />
      )}
      {activeTab === "risk" && <Risk stock={current} analytics={analytics[current.sym]} />}
      {activeTab === "portfolio" && <Portfolio />}
      {activeTab === "news" && <News stock={current} />}
    </>
  );

  const topBar = (
    <TopBar
      indices={indices}
      source={source}
      liveOn={liveOn}
      lastTickAt={lastTickAt}
      currentSymbol={currentSymbol}
      onToggleLive={() => setLiveOn((v) => !v)}
    />
  );

  const watchlistSheet = mobileSheetOpen && (
    <div className="mobile-sheet-backdrop" onClick={() => setMobileSheetOpen(false)}>
      <div className="mobile-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-sheet-grip" />
        {watchlistEl}
      </div>
    </div>
  );

  // ===== Mobile: sentiment-led front door + app-level nav (Market Pulse) =====
  if (isMobile) {
    const up = current.chg >= 0;

    const marketsSurface = (
      <div className="mobile-shell">
        <div className="mobile-stockbar">
          <div>
            <span className="sym">{current.sym}</span>{" "}
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>{current.sector}</span>
          </div>
          <div>
            <span className="price">₹{current.price.toFixed(2)}</span>{" "}
            <span className={`mono ${up ? "up" : "down"}`} style={{ fontSize: 12 }}>
              {up ? "+" : ""}
              {current.chgPct.toFixed(2)}%
            </span>
          </div>
        </div>
        {/* per-stock tabs as a top strip (bottom is the app nav now) */}
        <div className="tabs" style={{ margin: "0 14px", overflowX: "auto" }}>
          {TABS.map(([id, label]) => (
            <div key={id} className={`tab ${activeTab === id ? "active" : ""}`} onClick={() => setActiveTab(id)} style={{ whiteSpace: "nowrap" }}>
              {label.replace(" & sentiment", "")}
            </div>
          ))}
        </div>
        <div className="mobile-main">{activePanel}</div>
        <button className="mobile-fab" style={{ bottom: "calc(76px + env(safe-area-inset-bottom, 0px))" }} onClick={() => setMobileSheetOpen(true)}>
          ☰ {t("mobile.watchlist")}
        </button>
      </div>
    );

    return (
      <>
        {transitioning && (
          <PulseTransition
            onDone={() => {
              setTransitioning(false);
              setMode("simple");
              setMobileSurface("watchlist");
            }}
          />
        )}

        <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {mobileSurface === "pulse" && (
              <PulseHome
                key={pulseKey}
                onExplore={() => setTransitioning(true)}
                onOpenSector={(s) => {
                  const lead = stocks[s.lead];
                  if (lead) setCurrentSymbol(s.lead);
                  else addSymbol(s.lead);
                  setMobileSurface("markets");
                }}
                onAddPicks={(tickers) => {
                  tickers.forEach((t2) => addSymbol(t2));
                  setMode("simple");
                  setMobileSurface("watchlist");
                }}
              />
            )}
            {mobileSurface === "markets" && marketsSurface}
            {mobileSurface === "watchlist" && (
              <SimpleWatchlist
                stocks={rows}
                onOpen={(sym) => {
                  setCurrentSymbol(sym);
                  setMobileSurface("markets");
                }}
              />
            )}
            {mobileSurface === "profile" && <ProfileSurface currentSymbol={currentSymbol} />}
          </div>
          <MobileNav active={mobileSurface} onChange={goToSurface} />
        </div>
        {watchlistSheet}
      </>
    );
  }

  // ===== Desktop =====
  return (
    <>
      {topBar}

      {mode === "simple" ? (
        <div className="layout-simple">
          {watchlistEl}
          <SimpleView stock={current} />
        </div>
      ) : (
        <div className="layout">
          {watchlistEl}

          <div className="col">
            <StockHeader stock={current} />
            <div className="tabs">
              {TABS.map(([id, label]) => (
                <div key={id} className={`tab ${activeTab === id ? "active" : ""}`} onClick={() => setActiveTab(id)}>
                  {label}
                </div>
              ))}
            </div>
            <div className="tab-panels">{activePanel}</div>
          </div>

          <div className="col">
            <ConvictionGauge stock={current} />
            <ResearchNote key={current.sym} stock={current} analytics={analytics[current.sym]} />
          </div>
        </div>
      )}
    </>
  );
}
