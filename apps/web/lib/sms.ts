// OTP delivery. MSG91 (India-focused, cheaper for Indian numbers) when
// configured, else a dev fallback that logs the code to the server console
// and returns it to the caller so the credential-free demo is fully usable.
//
// Set MSG91_AUTH_KEY (+ optional MSG91_SENDER, MSG91_TEMPLATE_ID) in
// .env.local to send real SMS. Twilio would slot in the same way behind its
// own env vars if you prefer it.

export type SmsResult = { delivered: true } | { delivered: false; devCode: string };

function msg91Config(): { authKey: string; sender: string; templateId: string | null } | null {
  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) return null;
  return {
    authKey,
    sender: process.env.MSG91_SENDER || "VNTAGE",
    templateId: process.env.MSG91_TEMPLATE_ID || null,
  };
}

export function smsConfigured(): boolean {
  return msg91Config() !== null;
}

export async function sendOtpSms(phone: string, code: string): Promise<SmsResult> {
  const cfg = msg91Config();
  if (!cfg) {
    // Dev mode: never send, surface the code so login is testable without a
    // gateway. The API route echoes this only when SMS is unconfigured.
    console.log(`[sms:dev] OTP for ${phone} is ${code}`);
    return { delivered: false, devCode: code };
  }

  // MSG91 OTP flow. Phone must be digits with country code, no '+'.
  const mobile = phone.replace(/[^\d]/g, "");
  const url = `https://control.msg91.com/api/v5/otp?otp=${code}&mobile=${mobile}&authkey=${encodeURIComponent(
    cfg.authKey,
  )}&sender=${encodeURIComponent(cfg.sender)}${cfg.templateId ? `&template_id=${cfg.templateId}` : ""}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(`MSG91 send failed: ${res.status} ${await res.text()}`);
  return { delivered: true };
}

/** Normalize an Indian phone to E.164. Accepts 10-digit local numbers
 *  (assumes +91) or already-prefixed numbers. Returns null if implausible. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (raw.trim().startsWith("+") && digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}
