"use client";

// Viewport hook for the mobile breakpoint (below ~640px). SSR-safe: renders
// desktop first, then corrects on mount, so there's no hydration mismatch.

import { useEffect, useState } from "react";

export function useIsMobile(query = "(max-width: 639px)"): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return isMobile;
}
