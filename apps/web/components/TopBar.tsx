"use client";

import { useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import LoginSheet from "./auth/LoginSheet";
import AlertsPanel from "./alerts/AlertsPanel";
import { useT } from "@/lib/i18n/react";
import type { IndexQuote, QuoteSource } from "@/lib/types";

interface Props {
  indices: IndexQuote[];
  source: QuoteSource | null;
  liveOn: boolean;
  lastTickAt: number;
  currentSymbol: string;
  onToggleLive: () => void;
}

// NSE cash market hours: Mon–Fri, 09:15–15:30 IST.
function isMarketOpenIST(): boolean {
  const utcMinutes = Date.now() / 60000 + new Date().getTimezoneOffset();
  const istDate = new Date((utcMinutes + 330) * 60000);
  const day = istDate.getUTCDay();
  // istDate above is shifted, so read wall-clock via getUTC* on the shifted value
  const minutes = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
  return day >= 1 && day <= 5 && minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

export default function TopBar({ indices, source, liveOn, lastTickAt, currentSymbol, onToggleLive }: Props) {
  const [secsAgo, setSecsAgo] = useState(0);
  const [marketOpen, setMarketOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [triggeredCount, setTriggeredCount] = useState(0);
  const { user, authReady, logout, mode, toggleMode, locale, setLocale } = useApp();
  const t = useT();

  // Poll the user's alerts for triggered-but-unseen count (the bell badge).
  useEffect(() => {
    if (!user) {
      setTriggeredCount(0);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/alerts", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { alerts: { triggeredAt: string | null }[] };
        if (!cancelled) setTriggeredCount(data.alerts.filter((a) => a.triggeredAt).length);
      } catch {
        /* ignore */
      }
    };
    check();
    const iv = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [user, showAlerts]);

  useEffect(() => {
    setMarketOpen(isMarketOpenIST());
    const t = setInterval(() => {
      setSecsAgo(Math.floor((Date.now() - lastTickAt) / 1000));
      setMarketOpen(isMarketOpenIST());
    }, 1000);
    return () => clearInterval(t);
  }, [lastTickAt]);

  const updatedLabel = !liveOn ? "paused" : secsAgo <= 0 ? "updated just now" : `updated ${secsAgo}s ago`;

  return (
    <div className="topbar">
      {showLogin && <LoginSheet onClose={() => setShowLogin(false)} />}
      {showAlerts && <AlertsPanel currentSymbol={currentSymbol} onClose={() => setShowAlerts(false)} />}
      <div className="brand">
        <div className="brand-mark">V</div>
        <div className="brand-name">Vantage</div>
        <div className="brand-tag">{t("brand.tag")}</div>
      </div>

      <div className="index-strip">
        {indices.map((i) => {
          const up = i.changePct >= 0;
          const displayVal = i.decimals === 0 ? Math.round(i.value).toLocaleString("en-IN") : i.value.toFixed(i.decimals);
          return (
            <div className="index-item" key={i.name}>
              <div className="index-name">{i.name}</div>
              <div className="index-val mono">
                {i.prefix}
                {displayVal}{" "}
                <span className={`index-chg ${up ? "up" : "down"}`}>
                  {up ? "+" : ""}
                  {i.changePct.toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="live-controls">
        {source === "simulated" && (
          <div
            className="sim-badge"
            title="Prices update via a server-side random walk seeded from the sample data — not a real market feed. Configure an Upstox token to go live."
          >
            <span className="sim-dot" />
            SIMULATED LIVE
          </div>
        )}
        <div className="last-updated">{updatedLabel}</div>
        <button className={`live-toggle ${liveOn ? "" : "paused"}`} onClick={onToggleLive}>
          {liveOn ? `⏸ ${t("live.pause")}` : `▶ ${t("live.resume")}`}
        </button>
      </div>

      <div className={`market-pill ${marketOpen ? "" : "closed"}`}>
        <span className="market-dot" />
        {marketOpen ? t("market.open") : t("market.closed")}
      </div>

      <div className="mode-toggle" role="group" aria-label="View mode">
        <button className={mode === "simple" ? "active" : ""} onClick={() => mode !== "simple" && toggleMode()}>
          {t("mode.simple")}
        </button>
        <button className={mode === "pro" ? "active" : ""} onClick={() => mode !== "pro" && toggleMode()}>
          {t("mode.pro")}
        </button>
      </div>

      <div className="mode-toggle" role="group" aria-label="Language">
        <button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>
          EN
        </button>
        <button className={locale === "hi" ? "active" : ""} onClick={() => setLocale("hi")}>
          हिं
        </button>
      </div>

      {authReady &&
        (user ? (
          <div className="live-controls" style={{ gap: 8 }}>
            <button className="live-toggle alert-bell" onClick={() => setShowAlerts(true)} aria-label={t("nav.alerts")}>
              🔔
              {triggeredCount > 0 && <span className="alert-badge">{triggeredCount}</span>}
            </button>
            <span className="last-updated" title={user.phone}>
              {user.phone.replace(/(\+91)(\d{5})(\d{5})/, "$1 $2 $3")}
            </span>
            <button className="live-toggle" onClick={logout}>
              {t("nav.signOut")}
            </button>
          </div>
        ) : (
          <button className="live-toggle" onClick={() => setShowLogin(true)}>
            {t("nav.signIn")}
          </button>
        ))}
    </div>
  );
}
