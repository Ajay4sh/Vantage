"use client";

// Global app state shared across the terminal: the logged-in user (or null
// for anonymous browsing), the Simple/Pro view mode, and the UI locale.
//
// Persistence follows the prompt: localStorage for anonymous users, the DB
// (via /api/prefs) for logged-in ones. On login we adopt the server's saved
// prefs; on change while logged in we push them back.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Locale, Mode } from "@/lib/store";

export interface SessionUser {
  id: string;
  phone: string;
}

export interface RiskProfile {
  capital: number | null;
  riskPct: number;
}

interface AppState {
  user: SessionUser | null;
  authReady: boolean;
  mode: Mode;
  locale: Locale;
  capital: number | null;
  riskPct: number;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
  setLocale: (l: Locale) => void;
  setRiskProfile: (patch: Partial<RiskProfile>) => void;
  onLoggedIn: (
    user: SessionUser,
    prefs: { mode: Mode; locale: Locale; capital?: number | null; riskPct?: number },
  ) => void;
  logout: () => Promise<void>;
}

const MODE_KEY = "vantage:mode:v1";
const LOCALE_KEY = "vantage:locale:v1";
const RISK_KEY = "vantage:risk:v1";

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

function readLocal<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mode, setModeState] = useState<Mode>("pro");
  const [locale, setLocaleState] = useState<Locale>("en");
  const [capital, setCapitalState] = useState<number | null>(null);
  const [riskPct, setRiskPctState] = useState<number>(2);

  // Hydrate from localStorage, then reconcile with any server session.
  useEffect(() => {
    // First mobile visit (no stored preference) defaults to Simple mode, per
    // the mobile-first brief; desktop and returning users keep Pro.
    const storedMode = window.localStorage.getItem(MODE_KEY);
    if (!storedMode) {
      const mobileFirst = window.matchMedia("(max-width: 639px)").matches;
      setModeState(mobileFirst ? "simple" : "pro");
    } else {
      setModeState(readLocal(MODE_KEY, ["simple", "pro"] as const, "pro"));
    }
    setLocaleState(readLocal(LOCALE_KEY, ["en", "hi"] as const, "en"));
    // Risk profile (Phase 9) — hydrate from localStorage for anonymous users.
    try {
      const rawRisk = window.localStorage.getItem(RISK_KEY);
      if (rawRisk) {
        const r = JSON.parse(rawRisk) as Partial<RiskProfile>;
        if (typeof r.capital === "number") setCapitalState(r.capital);
        if (typeof r.riskPct === "number") setRiskPctState(r.riskPct);
      }
    } catch {
      /* corrupted storage — keep defaults */
    }
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await res.json()) as {
          user: SessionUser | null;
          prefs?: { mode: Mode; locale: Locale; capital?: number | null; riskPct?: number };
        };
        if (data.user) {
          setUser(data.user);
          if (data.prefs) {
            setModeState(data.prefs.mode);
            setLocaleState(data.prefs.locale);
            if (data.prefs.capital !== undefined) setCapitalState(data.prefs.capital);
            if (typeof data.prefs.riskPct === "number") setRiskPctState(data.prefs.riskPct);
          }
        }
      } catch {
        /* offline — stay anonymous with local prefs */
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  const persist = useCallback(
    (
      patch: { mode?: Mode; locale?: Locale; capital?: number | null; riskPct?: number },
      loggedIn: boolean,
    ) => {
      if (patch.mode) window.localStorage.setItem(MODE_KEY, patch.mode);
      if (patch.locale) window.localStorage.setItem(LOCALE_KEY, patch.locale);
      if (loggedIn) {
        fetch("/api/prefs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }).catch(() => {});
      }
    },
    [],
  );

  const setMode = useCallback(
    (m: Mode) => {
      setModeState(m);
      persist({ mode: m }, !!user);
    },
    [persist, user],
  );

  const toggleMode = useCallback(() => setMode(mode === "pro" ? "simple" : "pro"), [mode, setMode]);

  const setLocale = useCallback(
    (l: Locale) => {
      setLocaleState(l);
      persist({ locale: l }, !!user);
    },
    [persist, user],
  );

  // Phase 9 — trading capital + risk budget. Persisted to localStorage always,
  // and to the DB when signed in, so the "denominator" follows the user.
  const setRiskProfile = useCallback(
    (patch: Partial<RiskProfile>) => {
      const nextCapital = patch.capital !== undefined ? patch.capital : capital;
      const nextRisk = patch.riskPct !== undefined ? patch.riskPct : riskPct;
      setCapitalState(nextCapital);
      setRiskPctState(nextRisk);
      try {
        window.localStorage.setItem(RISK_KEY, JSON.stringify({ capital: nextCapital, riskPct: nextRisk }));
      } catch {
        /* storage blocked — non-fatal */
      }
      persist(patch, !!user);
    },
    [capital, riskPct, persist, user],
  );

  const onLoggedIn = useCallback(
    (
      u: SessionUser,
      prefs: { mode: Mode; locale: Locale; capital?: number | null; riskPct?: number },
    ) => {
      setUser(u);
      setModeState(prefs.mode);
      setLocaleState(prefs.locale);
      window.localStorage.setItem(MODE_KEY, prefs.mode);
      window.localStorage.setItem(LOCALE_KEY, prefs.locale);
      if (prefs.capital !== undefined) setCapitalState(prefs.capital);
      if (typeof prefs.riskPct === "number") setRiskPctState(prefs.riskPct);
    },
    [],
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  // Reflect locale on <html> for the Devanagari font switch (8.3).
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<AppState>(
    () => ({
      user,
      authReady,
      mode,
      locale,
      capital,
      riskPct,
      setMode,
      toggleMode,
      setLocale,
      setRiskProfile,
      onLoggedIn,
      logout,
    }),
    [
      user,
      authReady,
      mode,
      locale,
      capital,
      riskPct,
      setMode,
      toggleMode,
      setLocale,
      setRiskProfile,
      onLoggedIn,
      logout,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
