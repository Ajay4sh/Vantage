// Upstox auth helpers. The standard access token expires daily — the login
// flow is: open the authorization dialog URL, log in, get redirected with a
// ?code=, then exchange that code for an access token. Run
// `npm run refresh-token` (scripts/refresh-token.ts) each morning, or use a
// one-time analytics token (read-only market data) to skip the daily dance.

const AUTH_BASE = "https://api.upstox.com/v2";

export function authorizationUrl(apiKey: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: apiKey,
    redirect_uri: redirectUri,
  });
  return `${AUTH_BASE}/login/authorization/dialog?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  [key: string]: unknown;
}

export async function exchangeCodeForToken(opts: {
  apiKey: string;
  apiSecret: string;
  redirectUri: string;
  code: string;
}): Promise<TokenResponse> {
  const res = await fetch(`${AUTH_BASE}/login/authorization/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      code: opts.code,
      client_id: opts.apiKey,
      client_secret: opts.apiSecret,
      redirect_uri: opts.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as TokenResponse;
  if (!body.access_token) {
    throw new Error("Token exchange response missing access_token — response shape may have changed");
  }
  return body;
}

/** Token used for read-only market-data calls: prefer the daily standard
 *  token, fall back to the long-lived analytics token. */
export function marketDataToken(): string | null {
  return process.env.UPSTOX_ACCESS_TOKEN || process.env.UPSTOX_ANALYTICS_TOKEN || null;
}
