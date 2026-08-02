import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForRefreshToken } from "@/lib/google-oauth";
import { sealJson } from "@/lib/crypto";

export async function GET(req: Request) {
  await requireAdmin();

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(`Google returned an error: ${error}`, { status: 400 });
  }
  if (!code || !stateRaw) {
    return new Response("Missing code or state in Google's redirect.", { status: 400 });
  }

  let clientId: string;
  let provider: string;
  try {
    const decoded = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
    clientId = decoded.clientId;
    provider = decoded.provider;
    if (!clientId || !provider) throw new Error("missing clientId/provider in state");
  } catch {
    return new Response("Could not read the state parameter from Google's redirect.", { status: 400 });
  }

  let refreshToken: string;
  try {
    refreshToken = await exchangeCodeForRefreshToken(code);
  } catch (err) {
    return new Response(
      `Failed to exchange the authorization code: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 },
    );
  }

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
  if (!client) {
    return new Response(`No client found for id "${clientId}".`, { status: 404 });
  }

  const existing = await prisma.clientIntegration.findUnique({
    where: { clientId_provider: { clientId, provider } },
  });

  await prisma.clientIntegration.upsert({
    where: { clientId_provider: { clientId, provider } },
    create: {
      clientId,
      provider,
      config: {},
      credentials: sealJson({ refreshToken }),
      status: "ACTIVE",
    },
    update: {
      // Preserve existing config (e.g. a Gmail cursor already in progress)
      // — only the credentials and status change on re-consent.
      config: existing?.config ?? {},
      credentials: sealJson({ refreshToken }),
      status: "ACTIVE",
      lastError: null,
    },
  });

  return new Response(
    `Connected ${provider} for ${client.name}. You can close this tab.`,
    { status: 200, headers: { "Content-Type": "text/plain" } },
  );
}
