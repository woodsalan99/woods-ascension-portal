import { requireAdmin } from "@/lib/auth";
import { getConsentUrl, GOOGLE_SCOPES } from "@/lib/google-oauth";

// Admin-only, one-time-per-client consent kickoff (handoff §8: "No
// self-serve OAuth UI"). Alan clicks a link in the admin panel with
// ?clientId=...&provider=GMAIL, lands here, gets bounced to Google's
// consent screen. The client/provider pair rides through as the OAuth
// `state` param so the callback knows which ClientIntegration row to
// write to.
export async function GET(req: Request) {
  await requireAdmin();

  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId");
  const provider = url.searchParams.get("provider");

  if (!clientId || !provider || !(provider in GOOGLE_SCOPES)) {
    return new Response(`Missing or invalid clientId/provider. provider must be one of: ${Object.keys(GOOGLE_SCOPES).join(", ")}`, {
      status: 400,
    });
  }

  const state = Buffer.from(JSON.stringify({ clientId, provider })).toString("base64url");
  const consentUrl = getConsentUrl(provider as keyof typeof GOOGLE_SCOPES, state);

  return Response.redirect(consentUrl, 302);
}
