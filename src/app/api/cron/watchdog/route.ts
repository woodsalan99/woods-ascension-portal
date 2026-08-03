import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// The thing that notices when nothing is happening.
//
// Every other cron reports when it fails. None of them can report when they
// stop running at all — a crashed service, a deleted schedule, or an expired
// token just produces silence, and silence looks exactly like a quiet week.
// This route is the only check that treats absence as the signal.
//
// Everything here alerts Alan only. Bryan and Desiree are deliberately never
// on these — a client should never be told their own agency's plumbing broke.

// How long a source may stay silent before it counts as broken. Each is well
// past its real interval, so an ordinary blip or a deploy never fires it.
const MAX_SILENCE_MINUTES: Record<string, number> = {
  CALLRAIL: 45, // runs every 5 min
  GMAIL: 45, // runs every 5 min
  SMARTLEAD: 240, // runs hourly
  GSC: 36 * 60, // runs daily
  PLACES: 36 * 60, // runs daily
};

// Which sources a client is actually expected to produce, based on what's
// connected. A client with no Gmail integration must not trigger a
// "Gmail has gone silent" alert.
const PROVIDER_FOR_SOURCE: Record<string, string> = {
  CALLRAIL: "CALLRAIL",
  GMAIL: "GMAIL",
  GSC: "GSC",
  PLACES: "GOOGLE_PLACES",
};

const QUIET_LEAD_DAYS = 14;
const UNTOUCHED_LEAD_HOURS = 48;

// One alert per problem per day. Without this a broken CallRail sync would
// ping Alan's phone every time this route runs, which trains him to ignore it.
const REALERT_HOURS = 20;

async function alreadyWarned(clientId: string, signature: string): Promise<boolean> {
  const since = new Date(Date.now() - REALERT_HOURS * 3600_000);
  // Filtering inside a Json column isn't portable, so read the day's alerts
  // and compare in code — there are only ever a handful.
  const recent = await prisma.notification.findMany({
    where: { clientId, kind: "WATCHDOG", createdAt: { gte: since } },
    select: { payload: true },
  });
  return recent.some((n) => (n.payload as { signature?: string } | null)?.signature === signature);
}

async function warn(clientId: string, signature: string, title: string, message: string) {
  if (await alreadyWarned(clientId, signature)) return false;
  await notify({
    clientId,
    kind: "WATCHDOG",
    title,
    message,
    toClient: false, // Alan only, always
    payload: { signature },
  });
  return true;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await prisma.syncRun.updateMany({
    where: { status: "RUNNING", source: "WATCHDOG", startedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    data: { status: "FAILED", finishedAt: new Date(), detail: "Interrupted (likely a deploy during run)" },
  });
  const syncRun = await prisma.syncRun.create({ data: { status: "RUNNING", source: "WATCHDOG" } });

  const checks: string[] = [];
  let raised = 0;

  try {
    const clients = await prisma.client.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, type: true },
    });
    const integrations = await prisma.clientIntegration.findMany({
      where: { status: "ACTIVE" },
      select: { clientId: true, provider: true },
    });
    const connected = new Set(integrations.map((i) => `${i.clientId}:${i.provider}`));

    // ---- 1. Has each sync actually run? ----
    // SyncRun rows aren't per-client, so this is a single global check per
    // source, attributed to the first client that depends on it.
    for (const [source, maxMinutes] of Object.entries(MAX_SILENCE_MINUTES)) {
      const provider = PROVIDER_FOR_SOURCE[source];
      const dependants = provider
        ? clients.filter((c) => connected.has(`${c.id}:${provider}`))
        : clients.filter((c) => c.type === "COLD_EMAIL");
      if (dependants.length === 0) continue;

      const last = await prisma.syncRun.findFirst({
        where: { source, status: "SUCCESS" },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      });

      const silentFor = last ? Math.round((Date.now() - last.startedAt.getTime()) / 60_000) : null;
      checks.push(`${source}: ${silentFor === null ? "never run" : `${silentFor}m ago`}`);
      if (silentFor !== null && silentFor <= maxMinutes) continue;

      const hours = silentFor === null ? null : Math.round(silentFor / 60);
      raised += (await warn(
        dependants[0].id,
        `sync-silent:${source}`,
        `${source} sync has stopped`,
        silentFor === null
          ? `${source} has never completed a successful run. ${dependants.map((d) => d.name).join(", ")} depends on it.`
          : `${source} last succeeded ${hours && hours >= 2 ? `${hours} hours` : `${silentFor} minutes`} ago. Leads or numbers may be missing for ${dependants.map((d) => d.name).join(", ")}.`,
      ))
        ? 1
        : 0;
    }

    // ---- 2. Has a client gone quiet? ----
    const quietCutoff = new Date(Date.now() - QUIET_LEAD_DAYS * 86_400_000);
    for (const client of clients.filter((c) => c.type === "LOCAL_SERVICES")) {
      const recent = await prisma.serviceLead.count({
        where: { clientId: client.id, deletedAt: null, receivedAt: { gte: quietCutoff } },
      });
      checks.push(`${client.name}: ${recent} lead(s) in ${QUIET_LEAD_DAYS}d`);
      if (recent > 0) continue;

      // A brand-new client with no history yet isn't "quiet", it's new.
      const everHadOne = await prisma.serviceLead.count({ where: { clientId: client.id, deletedAt: null } });
      if (everHadOne === 0) continue;

      raised += (await warn(
        client.id,
        "no-leads",
        `${client.name} has gone quiet`,
        `No new leads for ${client.name} in ${QUIET_LEAD_DAYS} days. Worth checking the ads and the tracking number still work.`,
      ))
        ? 1
        : 0;
    }

    // ---- 3. Is a lead sitting untouched? ----
    const staleCutoff = new Date(Date.now() - UNTOUCHED_LEAD_HOURS * 3600_000);
    for (const client of clients.filter((c) => c.type === "LOCAL_SERVICES")) {
      const stale = await prisma.serviceLead.findMany({
        where: {
          clientId: client.id,
          deletedAt: null,
          stage: "NEW",
          receivedAt: { lt: staleCutoff },
          OR: [{ qualified: null }, { qualified: true }],
        },
        select: { id: true, name: true, receivedAt: true },
        orderBy: { receivedAt: "asc" },
      });
      if (stale.length === 0) continue;

      const names = stale.slice(0, 3).map((l) => l.name ?? "an unnamed lead");
      raised += (await warn(
        client.id,
        `stale-leads:${stale.length}`,
        `${stale.length} lead${stale.length === 1 ? "" : "s"} untouched at ${client.name}`,
        `${names.join(", ")}${stale.length > names.length ? ` and ${stale.length - names.length} more` : ""} ${
          stale.length === 1 ? "has" : "have"
        } sat in New for over ${UNTOUCHED_LEAD_HOURS} hours.`,
      ))
        ? 1
        : 0;
    }

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        detail: `${raised} alert(s) raised · ${checks.join(" · ")}`,
      },
    });
    return Response.json({ ok: true, raised, checks });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { status: "FAILED", finishedAt: new Date(), detail },
    });
    return Response.json({ ok: false, error: detail }, { status: 500 });
  }
}
