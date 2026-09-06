// Phase 7.3 / 8.3 — read and update the logged-in user's preferences
// (Simple/Pro mode, locale, saved watchlist). Anonymous users get 401 and
// keep their prefs in localStorage instead.

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { getPrefs, setPrefs, type Locale, type Mode, type UserPrefs } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ prefs: await getPrefs(user.id) });
}

export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Partial<UserPrefs> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const patch: Partial<UserPrefs> = {};
  if (body.mode === "simple" || body.mode === "pro") patch.mode = body.mode as Mode;
  if (body.locale === "en" || body.locale === "hi") patch.locale = body.locale as Locale;
  if (Array.isArray(body.watchlist)) {
    patch.watchlist = body.watchlist.filter((s): s is string => typeof s === "string").slice(0, 100);
  }
  // Phase 9 — trading capital (null clears it) and per-trade risk budget.
  if (body.capital === null) patch.capital = null;
  else if (typeof body.capital === "number" && Number.isFinite(body.capital) && body.capital >= 0) {
    patch.capital = Math.min(body.capital, 1e12);
  }
  if (typeof body.riskPct === "number" && Number.isFinite(body.riskPct)) {
    patch.riskPct = Math.max(0.1, Math.min(body.riskPct, 100));
  }
  return NextResponse.json({ prefs: await setPrefs(user.id, patch) });
}
