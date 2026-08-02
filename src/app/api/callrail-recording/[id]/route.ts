import { prisma } from "@/lib/prisma";
import { getScopedContext } from "@/lib/auth";
import { openJson } from "@/lib/crypto";
import { fetchRecordingAudio } from "@/lib/callrail";

// Streams a call recording's audio bytes in-portal. Never exposes the
// CallRail API key to the browser — same tenancy pattern as
// /api/documents/[id] (ADMINs can play any recording; CLIENTs only their
// own client's). Handoff §3.1: "clients may listen."
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let ctx;
  try {
    ctx = await getScopedContext();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const call = await prisma.callRecord.findUnique({ where: { id } });
  if (!call || !call.recordingUrl) return new Response("Not found", { status: 404 });

  if (ctx.role !== "ADMIN" && call.clientId !== ctx.clientId) {
    return new Response("Forbidden", { status: 403 });
  }

  const integration = await prisma.clientIntegration.findUnique({
    where: { clientId_provider: { clientId: call.clientId, provider: "CALLRAIL" } },
  });
  if (!integration) return new Response("CallRail integration not configured for this client", { status: 500 });

  const { apiKey } = openJson<{ apiKey: string }>(integration.credentials);

  try {
    const { body, contentType } = await fetchRecordingAudio({ apiKey, recordingUrl: call.recordingUrl });
    return new Response(body, {
      headers: { "Content-Type": contentType, "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return new Response(`Failed to fetch recording: ${err instanceof Error ? err.message : String(err)}`, { status: 502 });
  }
}
