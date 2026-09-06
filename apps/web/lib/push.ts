// Web push via Firebase Cloud Messaging. Configured behind env vars; when
// absent, push is a no-op and the in-app notification center (the triggered-
// alerts list) is the delivery channel. Same pattern as sms.ts / cache.ts:
// real service when credentials exist, graceful demo fallback otherwise.
//
// To enable: set FCM_SERVER_KEY (legacy HTTP API) and register device tokens.
// Token storage would live alongside the user record; omitted here since the
// in-app center covers the credential-free demo.

export function pushConfigured(): boolean {
  return !!process.env.FCM_SERVER_KEY;
}

export async function sendPush(tokens: string[], title: string, body: string): Promise<boolean> {
  const key = process.env.FCM_SERVER_KEY;
  if (!key || tokens.length === 0) {
    console.log(`[push:dev] would notify ${tokens.length} device(s): ${title} — ${body}`);
    return false;
  }
  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: { Authorization: `key=${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ registration_ids: tokens, notification: { title, body } }),
    });
    return res.ok;
  } catch (err) {
    console.error("FCM push failed:", err);
    return false;
  }
}
