"use client";

// Tiny translation hook. Reads the active locale from AppProvider and looks
// the key up in the locale dictionary, falling back to English, then to the
// key itself. Kept dependency-free and key-based so swapping in next-intl
// later (or adding languages) is a content task, not an engineering one.

import { useCallback } from "react";
import { useApp } from "@/components/AppProvider";
import { dictionaries, en } from "./dictionaries";

export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const { locale } = useApp();
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let str = dictionaries[locale]?.[key] ?? en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, String(v));
      return str;
    },
    [locale],
  );
}
