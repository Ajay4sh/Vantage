// Translation dictionaries. English is the source of truth and complete;
// Hindi (added in Phase 8.3) is partial and any missing key falls back to
// English via the t() lookup. Only UI chrome and note-template labels are
// translated — never tickers, numbers, or financial abbreviations (P/E, RSI…),
// which stay in standard notation per the build prompt.

import type { Locale } from "@/lib/store";

export type Dict = Record<string, string>;

export const en: Dict = {
  // Top bar / chrome
  "brand.tag": "Research Terminal",
  "market.open": "Market open",
  "market.closed": "Market closed",
  "live.pause": "Pause",
  "live.resume": "Resume",
  "nav.signIn": "Sign in",
  "nav.signOut": "Sign out",
  "nav.alerts": "Alerts",
  "mode.simple": "Simple",
  "mode.pro": "Pro",
  "mode.toggleToPro": "See full analysis",
  "mode.toggleToSimple": "Simple view",

  // Auth
  "auth.title": "Sign in to Vantage",
  "auth.subtitle": "Save watchlists, notes, and price alerts. Browsing stays open without an account.",
  "auth.mobile": "Mobile number",
  "auth.sendCode": "Send code",
  "auth.sending": "Sending…",
  "auth.enterCode": "Enter the code we sent",
  "auth.verify": "Verify & sign in",
  "auth.verifying": "Verifying…",
  "auth.changeNumber": "Change number",
  "auth.devNote": "Dev mode — no SMS gateway configured. Your code:",
  "auth.legal":
    "By continuing you agree this is a research tool, not investment advice, and not SEBI-registered research.",

  // Research note
  "note.title": "Research note",
  "note.generate": "Generate",
  "note.copy": "Copy",
  "note.copied": "Copied",
  "note.placeholder": "Click Generate to compile a synthesis note.",

  // Simple mode
  "simple.take": "Plain-language read",
  "simple.seeFull": "See full analysis →",
  "simple.noView": "Select a stock to see a plain-language read.",
  "simple.conviction": "Composite signal",

  // Alerts
  "alerts.title": "Alerts",
  "alerts.none": "No alerts yet. Add one from any stock's Options or Overview tab.",
  "alerts.new": "New alert",
  "alerts.create": "Create alert",
  "alerts.condition": "Condition",
  "alerts.threshold": "Value",
  "alerts.delete": "Delete",
  "alerts.triggered": "Triggered",
  "alerts.active": "Active",
  "alerts.signInRequired": "Sign in to create and manage price alerts.",
  "alerts.cond.price_above": "Price rises above",
  "alerts.cond.price_below": "Price falls below",
  "alerts.cond.cross_resistance": "Crosses resistance",
  "alerts.cond.cross_support": "Crosses support",
  "alerts.cond.iv_spike": "IV spikes above (%)",
  "alerts.cond.52w_high": "New 52-week high",
  "alerts.cond.52w_low": "New 52-week low",
  "alerts.cond.pcr_shift": "PCR crosses",

  // Disclaimer (shown in every mode + language)
  "disclaimer.body":
    "Sample data for demonstration. Not investment advice — this tool does not constitute SEBI-registered research. Verify all figures against live sources before acting.",

  // Explain-tooltip affordance
  "explain.label": "What is this?",

  // PWA
  "pwa.installPrompt": "Install Vantage for a full-screen, app-like experience.",
  "pwa.install": "Install",

  // Mobile chrome
  "mobile.watchlist": "Watchlist",
  "mobile.close": "Close",
};

// Hindi (Phase 8.3). UI chrome + note labels only — tickers, numbers, and
// financial abbreviations (P/E, RSI, IV, PCR, ROE…) intentionally stay in
// standard English notation. Any key absent here falls back to English.
export const hi: Dict = {
  "brand.tag": "रिसर्च टर्मिनल",
  "market.open": "बाज़ार खुला",
  "market.closed": "बाज़ार बंद",
  "live.pause": "रोकें",
  "live.resume": "जारी रखें",
  "nav.signIn": "साइन इन",
  "nav.signOut": "साइन आउट",
  "nav.alerts": "अलर्ट",
  "mode.simple": "सरल",
  "mode.pro": "प्रो",
  "mode.toggleToPro": "पूरा विश्लेषण देखें",
  "mode.toggleToSimple": "सरल दृश्य",

  "auth.title": "Vantage में साइन इन करें",
  "auth.subtitle": "वॉचलिस्ट, नोट्स और प्राइस अलर्ट सहेजें। खाते के बिना भी ब्राउज़िंग खुली रहती है।",
  "auth.mobile": "मोबाइल नंबर",
  "auth.sendCode": "कोड भेजें",
  "auth.sending": "भेजा जा रहा है…",
  "auth.enterCode": "भेजा गया कोड दर्ज करें",
  "auth.verify": "सत्यापित करें और साइन इन करें",
  "auth.verifying": "सत्यापित किया जा रहा है…",
  "auth.changeNumber": "नंबर बदलें",
  "auth.devNote": "डेव मोड — कोई SMS गेटवे कॉन्फ़िगर नहीं है। आपका कोड:",
  "auth.legal":
    "जारी रखकर आप सहमत हैं कि यह एक रिसर्च टूल है, निवेश सलाह नहीं, और SEBI-पंजीकृत रिसर्च नहीं है।",

  "note.title": "रिसर्च नोट",
  "note.generate": "तैयार करें",
  "note.copy": "कॉपी करें",
  "note.copied": "कॉपी हो गया",
  "note.placeholder": "संश्लेषण नोट बनाने के लिए 'तैयार करें' पर क्लिक करें।",

  "simple.take": "सरल भाषा में राय",
  "simple.seeFull": "पूरा विश्लेषण देखें →",
  "simple.noView": "सरल राय देखने के लिए कोई स्टॉक चुनें।",
  "simple.conviction": "समग्र संकेत",

  "alerts.title": "अलर्ट",
  "alerts.none": "अभी कोई अलर्ट नहीं। किसी भी स्टॉक के ऑप्शंस या ओवरव्यू टैब से जोड़ें।",
  "alerts.new": "नया अलर्ट",
  "alerts.create": "अलर्ट बनाएं",
  "alerts.condition": "शर्त",
  "alerts.threshold": "मान",
  "alerts.delete": "हटाएं",
  "alerts.triggered": "ट्रिगर हुए",
  "alerts.active": "सक्रिय",
  "alerts.signInRequired": "प्राइस अलर्ट बनाने और प्रबंधित करने के लिए साइन इन करें।",
  "alerts.cond.price_above": "कीमत इससे ऊपर जाए",
  "alerts.cond.price_below": "कीमत इससे नीचे जाए",
  "alerts.cond.cross_resistance": "रेज़िस्टेंस पार करे",
  "alerts.cond.cross_support": "सपोर्ट पार करे",
  "alerts.cond.iv_spike": "IV इससे ऊपर बढ़े (%)",
  "alerts.cond.52w_high": "नया 52-सप्ताह उच्च",
  "alerts.cond.52w_low": "नया 52-सप्ताह निम्न",
  "alerts.cond.pcr_shift": "PCR पार करे",

  "disclaimer.body":
    "प्रदर्शन के लिए नमूना डेटा। निवेश सलाह नहीं — यह टूल SEBI-पंजीकृत रिसर्च नहीं है। कार्रवाई से पहले सभी आंकड़े लाइव स्रोतों से सत्यापित करें।",

  "explain.label": "यह क्या है?",

  "pwa.installPrompt": "फ़ुल-स्क्रीन, ऐप जैसे अनुभव के लिए Vantage इंस्टॉल करें।",
  "pwa.install": "इंस्टॉल करें",

  "mobile.watchlist": "वॉचलिस्ट",
  "mobile.close": "बंद करें",
};

export const dictionaries: Record<Locale, Dict> = { en, hi };
