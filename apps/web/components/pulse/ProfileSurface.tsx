"use client";

// Mobile Profile surface — the settings home for the app-level nav. Account
// (phone-OTP sign in/out), view mode, language, and alerts all live here so
// the other surfaces stay focused.

import { useState } from "react";
import { useApp } from "../AppProvider";
import LoginSheet from "../auth/LoginSheet";
import AlertsPanel from "../alerts/AlertsPanel";
import { useT } from "@/lib/i18n/react";

export default function ProfileSurface({ currentSymbol }: { currentSymbol: string }) {
  const { user, mode, setMode, locale, setLocale, logout } = useApp();
  const t = useT();
  const [showLogin, setShowLogin] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  return (
    <div className="mobile-shell">
      {showLogin && <LoginSheet onClose={() => setShowLogin(false)} />}
      {showAlerts && <AlertsPanel currentSymbol={currentSymbol} onClose={() => setShowAlerts(false)} />}

      <div style={{ height: 60, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 20px" }}>
        <span className="display" style={{ fontWeight: 700, fontSize: 20, color: "var(--text)" }}>
          Profile
        </span>
      </div>

      <div className="mobile-main" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card">
          <div className="card-title">Account</div>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="mono" style={{ fontSize: 13, color: "var(--text)" }}>
                {user.phone.replace(/(\+91)(\d{5})(\d{5})/, "$1 $2 $3")}
              </span>
              <button className="btn" style={{ flex: "none", padding: "6px 12px" }} onClick={logout}>
                {t("nav.signOut")}
              </button>
            </div>
          ) : (
            <button className="btn primary" style={{ width: "100%" }} onClick={() => setShowLogin(true)}>
              {t("nav.signIn")}
            </button>
          )}
        </div>

        <div className="card">
          <div className="card-title">View mode</div>
          <div className="mode-toggle" role="group" aria-label="View mode" style={{ width: "fit-content" }}>
            <button className={mode === "simple" ? "active" : ""} onClick={() => setMode("simple")}>
              {t("mode.simple")}
            </button>
            <button className={mode === "pro" ? "active" : ""} onClick={() => setMode("pro")}>
              {t("mode.pro")}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Language</div>
          <div className="mode-toggle" role="group" aria-label="Language" style={{ width: "fit-content" }}>
            <button className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")}>
              EN
            </button>
            <button className={locale === "hi" ? "active" : ""} onClick={() => setLocale("hi")}>
              हिं
            </button>
          </div>
        </div>

        <button className="card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => (user ? setShowAlerts(true) : setShowLogin(true))}>
          <div className="card-title">{t("alerts.title")}</div>
          <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>
            {user ? "Manage your price & event alerts →" : t("alerts.signInRequired")}
          </span>
        </button>

        <div className="disclaimer" style={{ margin: 0 }}>
          {t("disclaimer.body")}
        </div>
      </div>
    </div>
  );
}
