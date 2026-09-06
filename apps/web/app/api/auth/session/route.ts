// Phase 7.1 — current session probe. Returns the logged-in user + prefs, or
// { user: null } for anonymous visitors (who can still browse everything).

import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { getPrefs } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: user.id, phone: user.phone }, prefs: await getPrefs(user.id) });
}
