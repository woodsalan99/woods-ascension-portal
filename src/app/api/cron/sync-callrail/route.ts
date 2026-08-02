import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { openJson } from "@/lib/crypto";
import { fetchCalls, classifyCall, isLsaLine, type CallRailConfig } from "@/lib/callrail";
import { notify } from "@/lib/notify";

// Copies /api/cron/sync's conventions exactly (CRON_SECRET guard, one
// SyncRun row, self-heal for stuck RUNNING rows) — scoped to
// source: "CALLRAIL" throughout so a fast-cycling route (sync-gmail, every
// 5 min) can never mark this one's still-running sync as FAILED. See
// IMPLEMENTATION_STATE.md D-E.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await prisma.syncRun.updateMany({
    where: { status: "RUNNING", source: "CALLRAIL", startedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    data: { status: "FAILED", finishedAt: new Date(), detail: "Interrupted (likely a deploy during sync)" },
  });

  const syncRun = await prisma.syncRun.create({ data: { status: "RUNNING", source: "CALLRAIL" } });

  try {
    const integrations = await prisma.clientIntegration.findMany({
      where: { provider: "CALLRAIL", status: "ACTIVE", client: { status: "ACTIVE", type: "LOCAL_SERVICES" } },
      include: { client: true },
    });

    let callsSynced = 0;
    let leadsCreated = 0;

    for (const integ of integrations) {
      let apiKey: string;
      try {
        ({ apiKey } = openJson<{ apiKey: string }>(integ.credentials));
      } catch (err) {
        await prisma.clientIntegration.update({
          where: { id: integ.id },
          data: { status: "ERROR", lastError: `Failed to decrypt credentials: ${err instanceof Error ? err.message : String(err)}` },
        });
        await notify({
          clientId: integ.clientId,
          kind: "SYNC_FAILURE",
          title: "CallRail sync failure",
          message: `Could not read stored CallRail credentials for ${integ.client.name}.`,
          toClient: false,
        });
        continue;
      }

      const config = integ.config as CallRailConfig;
      const since = config.cursor ?? new Date(Date.now() - 24 * 60 * 60_000).toISOString();

      let calls;
      try {
        calls = await fetchCalls({ apiKey, accountId: config.accountId, sinceIso: since });
      } catch (err) {
        await prisma.clientIntegration.update({
          where: { id: integ.id },
          data: { status: "ERROR", lastError: err instanceof Error ? err.message : String(err) },
        });
        await notify({
          clientId: integ.clientId,
          kind: "SYNC_FAILURE",
          title: "CallRail sync failure",
          message: `CallRail fetch failed for ${integ.client.name}: ${err instanceof Error ? err.message : String(err)}`,
          toClient: false,
        });
        continue;
      }

      let latestOccurredAt = since;

      for (const call of calls) {
        const { classification, needsReview } = classifyCall(call, config);
        const source = isLsaLine(call, config) ? "LSA" : "GBP_CALL";

        const record = await prisma.callRecord.upsert({
          where: { callRailId: call.id },
          create: {
            clientId: integ.clientId,
            callRailId: call.id,
            occurredAt: new Date(call.occurredAt),
            durationSec: call.durationSec,
            callerNumber: call.callerNumber,
            trackingNumber: call.trackingNumber,
            keypress: call.keypress,
            classification,
            needsReview,
            forwarded: call.answered,
            recordingUrl: call.recordingUrl,
            raw: call.raw as Prisma.InputJsonValue,
          },
          update: { classification, needsReview, forwarded: call.answered, recordingUrl: call.recordingUrl },
        });
        callsSynced++;
        if (call.occurredAt && call.occurredAt > latestOccurredAt) latestOccurredAt = call.occurredAt;

        if (classification === "QUALIFIED") {
          const existingLead = await prisma.serviceLead.findUnique({ where: { callRecordId: record.id } });
          if (!existingLead) {
            await prisma.serviceLead.create({
              data: {
                clientId: integ.clientId,
                source,
                stage: "NEW",
                callRecordId: record.id,
                callRailUrl: `https://app.callrail.com/calls/${call.id}`,
                recordingUrl: call.recordingUrl,
                receivedAt: new Date(call.occurredAt),
              },
            });
            leadsCreated++;
            await notify({
              clientId: integ.clientId,
              kind: "NEW_LEAD",
              title: "New call lead",
              message: `A new ${source === "LSA" ? "Google Ads" : "Google Maps"} call came in for ${integ.client.name}.`,
            });
          }
        }
      }

      await prisma.clientIntegration.update({
        where: { id: integ.id },
        data: { config: { ...config, cursor: latestOccurredAt }, lastSyncAt: new Date(), status: "ACTIVE", lastError: null },
      });
    }

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        finishedAt: new Date(),
        status: "SUCCESS",
        detail: `${callsSynced} call(s) synced across ${integrations.length} integration(s), ${leadsCreated} lead(s) created`,
      },
    });

    return Response.json({ ok: true, callsSynced, leadsCreated });
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { finishedAt: new Date(), status: "FAILED", detail: err instanceof Error ? err.message : String(err) },
    });
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
