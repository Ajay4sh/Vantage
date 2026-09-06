// Phase 7.1 — request an OTP for a phone number. In dev (no SMS gateway
// configured) the code is returned in the response so login is testable
// without MSG91/Twilio; once MSG91_AUTH_KEY is set, it's sent by SMS and
// never echoed.

import { NextRequest, NextResponse } from "next/server";
import { normalizePhone, sendOtpSms, smsConfigured } from "@/lib/sms";
import { putOtp } from "@/lib/store";

export const dynamic = "force-dynamic";

const OTP_TTL_SECONDS = 300;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { phone?: string } | null;
  const phone = normalizePhone(body?.phone ?? "");
  if (!phone) {
    return NextResponse.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  putOtp(phone, code, OTP_TTL_SECONDS);

  try {
    const result = await sendOtpSms(phone, code);
    return NextResponse.json({
      phone,
      sent: result.delivered,
      // Only surfaced in dev (SMS unconfigured) so the demo is usable.
      devCode: result.delivered ? undefined : (result as { devCode: string }).devCode,
      smsConfigured: smsConfigured(),
    });
  } catch (err) {
    console.error("OTP send failed:", err);
    return NextResponse.json({ error: "Could not send OTP. Try again." }, { status: 502 });
  }
}
