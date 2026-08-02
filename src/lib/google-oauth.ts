import { google } from "googleapis";

// One Google Cloud OAuth app (env-configured), shared across every
// client's Gmail/GSC/Places consent — the per-client refresh token itself
// lives sealed in ClientIntegration, not here. No self-serve OAuth UI:
// Alan completes the one-time consent per client via an admin-only route
// (src/app/admin/integrations/connect-google/route.ts + the callback).

// Scopes needed per provider — Phase 3 only exercises GMAIL; GSC/PLACES
// are wired here so Phase 4 reuses the same consent flow without changes.
export const GOOGLE_SCOPES: Record<string, string[]> = {
  // gmail.send is needed to forward a parsed lead on to the client as a
  // clean summary email. Adding a scope invalidates nothing, but the
  // EXISTING refresh token won't carry the new permission — Alan has to
  // run the connect flow once more for send to start working.
  GMAIL: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"],
  GSC: ["https://www.googleapis.com/auth/webmasters.readonly"],
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not configured`);
  return v;
}

export function createOAuthClient() {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
    requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    requireEnv("GOOGLE_OAUTH_REDIRECT_URI"),
  );
}

export function getConsentUrl(provider: keyof typeof GOOGLE_SCOPES, state: string): string {
  const scopes = GOOGLE_SCOPES[provider];
  if (!scopes) throw new Error(`No OAuth scopes configured for provider "${provider}"`);
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // force a fresh refresh_token even on repeat consent
    scope: scopes,
    state,
  });
}

// Exchanges a one-time authorization code (from the OAuth callback) for
// tokens. Throws if Google doesn't return a refresh_token — that happens
// when consent was already granted for this scope set and Google decides
// not to re-issue one; `prompt: "consent"` above is what avoids this in
// the normal flow.
export async function exchangeCodeForRefreshToken(code: string): Promise<string> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token — try the consent flow again (it should force re-consent)");
  }
  return tokens.refresh_token;
}

// Builds an authenticated OAuth2 client from a stored refresh token — the
// googleapis client library handles exchanging it for a fresh access token
// automatically on each request.
export function clientFromRefreshToken(refreshToken: string) {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}
