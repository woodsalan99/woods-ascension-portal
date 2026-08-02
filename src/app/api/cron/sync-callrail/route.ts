import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { openJson } from "@/lib/crypto";
import { fetchCalls, fetchTextMessages, classifyCall, isLsaLine, type CallRailConfig } from "@/lib/callrail";
import { recordContact, findExistingLead } from "@/lib/lead-identity";
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
    let textsLogged = 0;

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
        calls = await fetchCalls({ apiKey, accountId: config.accountId, companyId: config.companyId, sinceIso: since });
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

        const identity = { personId: call.personId, phone: call.callerNumber, name: call.callerName };
        const mins = Math.floor(call.durationSec / 60);
        const secs = call.durationSec % 60;
        const lengthLabel = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        const callRailUrl = `https://app.callrail.com/calls/${call.id}`;

        if (classification === "QUALIFIED") {
          const result = await recordContact({
            clientId: integ.clientId,
            identity,
            event: {
              type: "CALL",
              dedupeKey: `call:${call.id}`,
              occurredAt: new Date(call.occurredAt),
              summary: `Called and got through — ${lengthLabel}`,
              meta: { callRecordId: record.id, recordingUrl: call.recordingUrl, callRailUrl, source },
            },
            create: {
              source,
              stage: "NEW",
              name: call.callerName,
              phone: call.callerNumber,
              callRecordId: record.id,
              callRailUrl,
              recordingUrl: call.recordingUrl,
              receivedAt: new Date(call.occurredAt),
            },
            enrich: { name: call.callerName, phone: call.callerNumber, recordingUrl: call.recordingUrl, callRailUrl },
          });

          // Only announce genuinely new people and genuinely new calls — a
          // repeat caller shouldn't look like a brand-new lead, and a
          // re-sync shouldn't re-notify at all.
          if (result.isNewEvent) {
            if (result.isNewLead) leadsCreated++;
            await notify({
              clientId: integ.clientId,
              kind: "NEW_LEAD",
              title: result.isNewLead ? "New call lead" : `Repeat call — ${result.lead.name ?? call.callerNumber}`,
              message: result.isNewLead
                ? `A new ${source === "LSA" ? "Google Ads" : "Google Maps"} call came in for ${integ.client.name}.`
                : `${result.lead.name ?? call.callerNumber} called again (${lengthLabel}).`,
            });
          }
        } else {
          // Missed / not connected. Deliberately does NOT create a lead or
          // notify — but if we already know this person, the attempt goes
          // on their timeline so a repeat caller's missed attempts are
          // visible rather than invisible.
          //
          // NOTE: CallRail does not expose whether the caller pressed a key
          // (keypad_entries is null on every call, including ones that
          // demonstrably pressed and connected), so we cannot say whether a
          // missed call got through the menu. The summary states only what
          // is actually knowable.
          const existing = await findExistingLead(integ.clientId, identity);
          if (existing) {
            await recordContact({
              clientId: integ.clientId,
              identity,
              event: {
                type: "MISSED_CALL",
                dedupeKey: `call:${call.id}`,
                occurredAt: new Date(call.occurredAt),
                summary: `Missed call — rang ${lengthLabel}, not answered (CallRail can't tell us whether they pressed a key)`,
                meta: { callRecordId: record.id, callRailUrl },
              },
              create: {
                source,
                stage: "NEW",
                name: call.callerName,
                phone: call.callerNumber,
                receivedAt: new Date(call.occurredAt),
              },
            });
          }
        }
      }

      // ---- Text messages ----
      // Attached to whoever they're from. Texts never create a lead on
      // their own: the tracking number receives a lot of cold-outreach
      // spam (visible in the real data), and an unknown texter with no
      // other contact isn't yet worth a card on the board.
      try {
        const texts = await fetchTextMessages({ apiKey, accountId: config.accountId, companyId: config.companyId });
        for (const t of texts) {
          const existing = await findExistingLead(integ.clientId, { phone: t.customerPhone, name: t.customerName });
          if (!existing) continue;
          const stamp = t.createdAt ? new Date(t.createdAt) : new Date();
          const result = await recordContact({
            clientId: integ.clientId,
            identity: { phone: t.customerPhone, name: t.customerName },
            event: {
              type: "TEXT",
              // Threads carry several messages; key on thread + timestamp.
              dedupeKey: `text:${t.threadId}:${t.createdAt}`,
              occurredAt: stamp,
              summary: `${t.direction === "incoming" ? "Texted in" : "Text sent"}: ${t.content.slice(0, 160)}`,
              meta: { direction: t.direction, content: t.content, conversationId: t.conversationId },
            },
            create: {
              source: "GBP_CALL",
              stage: "NEW",
              name: t.customerName,
              phone: t.customerPhone,
              receivedAt: stamp,
            },
          });
          if (result.isNewEvent) textsLogged++;
        }
      } catch (err) {
        // Texting is a bonus signal — never fail the whole call sync for it.
        await notify({
          clientId: integ.clientId,
          kind: "SYNC_FAILURE",
          title: "CallRail text sync issue",
          message: `Couldn't pull text messages for ${integ.client.name}: ${err instanceof Error ? err.message : String(err)}`,
          toClient: false,
        });
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
        detail: `${callsSynced} call(s) synced across ${integrations.length} integration(s), ${leadsCreated} new lead(s), ${textsLogged} text(s) logged`,
      },
    });

    return Response.json({ ok: true, callsSynced, leadsCreated, textsLogged });
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { finishedAt: new Date(), status: "FAILED", detail: err instanceof Error ? err.message : String(err) },
    });
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
