// Daily Upstox access-token refresh helper.
//
// The standard Upstox token expires every day. Run this each morning before
// market open (or wire it to a cron — check Upstox ToS before automating the
// login itself with a headless browser):
//
//   1. npm run refresh-token
//      -> prints the login URL. Open it, log in, and you'll be redirected to
//         UPSTOX_REDIRECT_URI with a ?code=XXXX parameter.
//   2. npm run refresh-token -- <code>
//      -> exchanges the code and prints the access token to paste into
//         apps/web/.env.local as UPSTOX_ACCESS_TOKEN.
//
// If you're using a one-time analytics token (read-only market data), you
// don't need this script at all.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { authorizationUrl, exchangeCodeForToken } from "../lib/upstox/token";

// tsx doesn't auto-load .env.local — parse it by hand, no dotenv dep needed.
function loadEnvLocal() {
  const path = resolve(__dirname, "..", ".env.local");
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnvLocal();

  const apiKey = process.env.UPSTOX_API_KEY;
  const apiSecret = process.env.UPSTOX_API_SECRET;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI || "http://localhost:3100/callback";

  if (!apiKey || !apiSecret) {
    console.error("Set UPSTOX_API_KEY and UPSTOX_API_SECRET in apps/web/.env.local first.");
    process.exit(1);
  }

  const code = process.argv[2];
  if (!code) {
    console.log("Step 1 — open this URL, log in, and copy the ?code= from the redirect:\n");
    console.log(`  ${authorizationUrl(apiKey, redirectUri)}\n`);
    console.log("Step 2 — exchange it:  npm run refresh-token -- <code>");
    return;
  }

  const token = await exchangeCodeForToken({ apiKey, apiSecret, redirectUri, code });
  console.log("\nAccess token (valid until end of trading day):\n");
  console.log(`  UPSTOX_ACCESS_TOKEN=${token.access_token}\n`);
  console.log("Paste that line into apps/web/.env.local and restart the dev server.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
