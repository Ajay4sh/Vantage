"use client";

// Phone + OTP login modal. Two steps: enter number → enter the 6-digit code.
// When no SMS gateway is configured the request-otp response carries the code
// (dev convenience) and we prefill it with a visible "dev mode" note, so the
// whole flow is demoable without MSG91/Twilio.

import { useState } from "react";
import { useApp } from "../AppProvider";
import { useT } from "@/lib/i18n/react";

export default function LoginSheet({ onClose }: { onClose: () => void }) {
  const { onLoggedIn } = useApp();
  const t = useT();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setDevCode(data.devCode ?? null);
      if (data.devCode) setCode(data.devCode);
      setStep("code");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed.");
        return;
      }
      onLoggedIn(data.user, data.prefs);
      onClose();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 340, maxWidth: "100%", padding: 22 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div className="display" style={{ fontSize: 18, fontWeight: 700 }}>
            {t("auth.title")}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: 16 }}>
            ✕
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-3)", margin: "0 0 16px" }}>{t("auth.subtitle")}</p>

        {step === "phone" && (
          <>
            <label className="metric-label">{t("auth.mobile")}</label>
            <div className="search" style={{ margin: "6px 0 12px" }}>
              <span className="mono" style={{ color: "var(--text-3)", fontSize: 12 }}>
                +91
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98765 43210"
                inputMode="numeric"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && requestOtp()}
              />
            </div>
            <button className="btn primary" style={{ width: "100%" }} disabled={busy} onClick={requestOtp}>
              {busy ? t("auth.sending") : t("auth.sendCode")}
            </button>
          </>
        )}

        {step === "code" && (
          <>
            <label className="metric-label">{t("auth.enterCode")}</label>
            <div className="search" style={{ margin: "6px 0 12px" }}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                inputMode="numeric"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
              />
            </div>
            {devCode && (
              <p style={{ fontSize: 10.5, color: "var(--gold)", margin: "0 0 12px" }}>
                {t("auth.devNote")} <b className="mono">{devCode}</b>
              </p>
            )}
            <button className="btn primary" style={{ width: "100%" }} disabled={busy} onClick={verifyOtp}>
              {busy ? t("auth.verifying") : t("auth.verify")}
            </button>
            <button
              className="btn"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => {
                setStep("phone");
                setCode("");
                setDevCode(null);
                setError(null);
              }}
            >
              {t("auth.changeNumber")}
            </button>
          </>
        )}

        {error && <p style={{ fontSize: 11, color: "var(--neg)", margin: "12px 0 0" }}>{error}</p>}

        <p style={{ fontSize: 9.5, color: "var(--text-3)", margin: "16px 0 0", lineHeight: 1.5 }}>{t("auth.legal")}</p>
      </div>
    </div>
  );
}
