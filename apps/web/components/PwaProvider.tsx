"use client";

// Registers the app-shell service worker and surfaces an "Add to Home Screen"
// prompt. The prompt uses the browser's own beforeinstallprompt event (Chrome/
// Edge/Android); on iOS Safari, which doesn't fire it, we show a one-line hint
// instead. Dismissals are remembered so we don't nag.

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "vantage:a2hs-dismissed:v1";

export default function PwaProvider() {
  const t = useT();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => console.error("SW registration failed", err));
    }

    if (localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  };

  if (!showBanner) return null;

  return (
    <div className="a2hs-banner">
      <span className="brand-mark" style={{ width: 22, height: 22, fontSize: 12 }}>
        V
      </span>
      <span style={{ flex: 1, fontSize: 12 }}>{t("pwa.installPrompt")}</span>
      <button className="btn primary" style={{ flex: "none", padding: "6px 12px" }} onClick={install}>
        {t("pwa.install")}
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: 14 }}
      >
        ✕
      </button>
    </div>
  );
}
