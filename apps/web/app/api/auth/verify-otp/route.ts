// Phase 7.1 — verify an OTP and open a session. On success, mints a signed
// JWT into an httpOnly cookie and returns the user + their saved prefs.

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, signSession } from "@/lib/auth/jwt";
import { normalizePhone } from "@/lib/sms";
import { checkOtp, findOrCreateUser, getPrefs } from "@/lib/store";

export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  expired: "That code has expired. Request a new one.",
  mismatch: "Incorrect code. Check and try again.",
  too_many: "Too many attempts. Request a new code.",
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { phone?: string; code?: string } | null;
  const phone = normalizePhone(body?.phone ?? "");
  const code = (body?.code ?? "").trim();
  if (!phone || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  const result = checkOtp(phone, code);
  if (result !== "ok") {
    return NextResponse.json({ error: ERR[result] }, { status: 401 });
  }

  const user = await findOrCreateUser(phone);
  const token = signSession({ sub: user.id, phone: user.phone });
  const res = NextResponse.json({ user: { id: user.id, phone: user.phone }, prefs: await getPrefs(user.id) });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
