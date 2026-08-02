import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { openJson } from "@/lib/crypto";
import { listNewMessages, getMessage, type GmailCursor } from "@/lib/gmail";
import { lsaMatcher, formMatcher, type GmailMatcherConfig } from "@/lib/gmail-parsers";
import { classifySpam } from "@/lib/spam-classify";
import { notify } from "@/lib/notify";

const SPAM_CONFIDENCE_THRESHOLD = 0.75;
const WATCHDOG_GRACE_MS = 7 * 24 * 60 * 60_000;
const WATCHDOG_WINDOW_MS = 7 * 24 * 60 * 60_000;
const WATCHDOG_DEDUPE_MS = 24 * 60 * 60_000;

// Same shell as /api/cron/sync and /api/cron/sync-callrail: CRON_SECRET
// guard, one SyncRun row scoped to source: "GMAIL", self-heal scoped the
// same way. Runs every 5 minutes (Railway cron) — this is the mechanism
// that replaces Google's own unreliable LSA notifications (handoff §3.2A).
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await prisma.syncRun.updateMany({
    where: { status: "RUNNING", source: "GMAIL", startedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    data: { status: "FAILED", finishedAt: new Date(), detail: "Interrupted (likely a deploy during sync)" },
  });

  const syncRun = await prisma.syncRun.create({ data: { status: "RUNNING", source: "GMAIL" } });

  let messagesProcessed = 0;
  let leadsCreated = 0;
  let spamLogged = 0;
  let parseFailures = 0;

  try {
    const integrations = await prisma.clientIntegration.findMany({
      where: { provider: "GMAIL", status: "ACTIVE", client: { status: "ACTIVE", type: "LOCAL_SERVICES" } },
      include: { client: true },
    });

    for (const integ of integrations) {
      let refreshToken: string;
      try {
        ({ refreshToken } = openJson<{ refreshToken: string }>(integ.credentials));
      } catch (err) {
        await prisma.clientIntegration.update({
          where: { id: integ.id },
          data: { status: "ERROR", lastError: `Failed to decrypt credentials: ${err instanceof Error ? err.message : String(err)}` },
        });
        continue;
      }

      const config = integ.config as GmailMatcherConfig & { cursor?: GmailCursor };
      const cursor: GmailCursor = config.cursor ?? {};

      let listResult;
      try {
        listResult = await listNewMessages(refreshToken, cursor);
      } catch (err) {
        // Transient API error — do NOT advance the cursor, so the next
        // 5-minute run retries from the same place.
        await prisma.clientIntegration.update({
          where: { id: integ.id },
          data: { status: "ERROR", lastError: err instanceof Error ? err.message : String(err) },
        });
        await notify({
          clientId: integ.clientId,
          kind: "SYNC_FAILURE",
          title: "Gmail sync failure",
          message: `Gmail sync failed for ${integ.client.name}: ${err instanceof Error ? err.message : String(err)}`,
          toClient: false,
        });
        continue;
      }

      for (const messageId of listResult.messageIds) {
        let fetched;
        try {
          fetched = await getMessage(refreshToken, messageId);
        } catch (err) {
          // Same transient-error handling as above, but per-message: skip
          // this message, don't advance the cursor for this integration
          // this run, so it (and any not-yet-processed messages) are
          // retried next run.
          await notify({
            clientId: integ.clientId,
            kind: "SYNC_FAILURE",
            title: "Gmail sync failure",
            message: `Failed to fetch a Gmail message for ${integ.client.name}: ${err instanceof Error ? err.message : String(err)}`,
            toClient: false,
          });
          continue;
        }
        if (!fetched) continue;
        const { meta, text } = fetched;
        messagesProcessed++;

        try {
        if (lsaMatcher.matches(meta, config)) {
          const existing = await prisma.serviceLead.findUnique({ where: { gmailMessageId: meta.id } });
          if (existing) continue;

          const outcome = lsaMatcher.parse({ text }, meta);
          if (outcome.ok) {
            await prisma.serviceLead.create({
              data: {
                clientId: integ.clientId,
                source: "LSA",
                stage: "NEW",
                gmailMessageId: meta.id,
                name: outcome.data.name,
                phone: outcome.data.phone,
                location: outcome.data.location,
                serviceType: outcome.data.serviceType,
                message: outcome.data.message,
                // Google withholds the customer's name/number on a new
                // request until you reply. On the customer-message variant
                // they've often just given a number — so only flag
                // needs-details when we genuinely don't have one.
                needsDetails: !outcome.data.phone,
                receivedAt: outcome.data.receivedAt,
              },
            });
          } else {
            // Never lose the email even if it didn't parse as expected —
            // create a bare lead so it's visible on the board for manual
            // follow-up, and flag the parse failure for review.
            parseFailures++;
            await prisma.serviceLead.create({
              data: {
                clientId: integ.clientId,
                source: "LSA",
                stage: "NEW",
                gmailMessageId: meta.id,
                needsDetails: true,
                message: `(Could not parse this LSA email automatically — check Gmail directly. Reason: ${outcome.reason})`,
                receivedAt: new Date(meta.internalDate),
              },
            });
          }
          leadsCreated++;

          const lsa = outcome.ok ? outcome.data : null;
          const lsaWhere = [lsa?.serviceType, lsa?.location].filter(Boolean).join(" · ");
          await notify({
            clientId: integ.clientId,
            kind: "NEW_LEAD",
            title: lsa?.phone ? `Google Ads lead — ${lsa.phone}` : "New Google Ads lead",
            message:
              [lsaWhere, lsa?.message].filter(Boolean).join(" — ").slice(0, 240) ||
              "A new Google Local Services Ads lead came in. Open Google to see the details.",
            emailBody: [
              lsa?.phone
                ? `A Google Ads customer replied with their number: ${lsa.phone}`
                : "A new Google Local Services Ads lead just came in.",
              "",
              lsaWhere ? `Job:      ${lsaWhere}` : null,
              lsa?.phone ? `Phone:    ${lsa.phone}` : null,
              "",
              lsa?.message ? "What they said:" : null,
              lsa?.message ?? null,
              "",
              lsa?.phone
                ? "You can call them straight back."
                : "Google hides the customer's name and number until you reply. Open the Local Services app, or sign in at https://ads.google.com/local-services-ads to reply and reveal their details.",
              "",
              "This lead is also on your Leads page: https://portal.woodsascension.com/leads",
            ]
              .filter((line) => line !== null)
              .join("\n"),
          });
          continue;
        }

        if (formMatcher.matches(meta, config)) {
          const existing = await prisma.formSubmission.findUnique({ where: { gmailMessageId: meta.id } });
          if (existing) continue;

          const outcome = formMatcher.parse({ text }, meta);
          if (!outcome.ok) {
            parseFailures++;
            await prisma.formSubmission.create({
              data: {
                clientId: integ.clientId,
                gmailMessageId: meta.id,
                receivedAt: new Date(meta.internalDate),
                spamVerdict: null,
                passedOn: false,
                raw: { rawBody: text, parseError: outcome.reason } as Prisma.InputJsonValue,
              },
            });
            await notify({
              clientId: integ.clientId,
              kind: "SYNC_FAILURE",
              title: "Form submission needs review",
              message: `A website form email for ${integ.client.name} didn't parse as expected — check it in the admin panel.`,
              toClient: false,
            });
            continue;
          }

          const verdict = await classifySpam({
            name: outcome.data.name,
            phone: outcome.data.phone || null,
            email: outcome.data.email || null,
            location: outcome.data.city,
            message: outcome.data.message || null,
          });

          const confident = verdict.confidence >= SPAM_CONFIDENCE_THRESHOLD;
          const spamVerdict = confident ? verdict.qualified : null; // null = ambiguous, needs Alan's review
          const passedOn = confident && verdict.qualified;

          const submission = await prisma.formSubmission.create({
            data: {
              clientId: integ.clientId,
              gmailMessageId: meta.id,
              receivedAt: outcome.data.receivedAt,
              name: outcome.data.name,
              phone: outcome.data.phone,
              email: outcome.data.email,
              address: outcome.data.address,
              message: outcome.data.message,
              spamVerdict,
              spamConfidence: verdict.confidence,
              spamReason: verdict.reason,
              passedOn,
              raw: { rawBody: text, page: outcome.data.page, site: outcome.data.site } as Prisma.InputJsonValue,
            },
          });

          if (spamVerdict === false) {
            spamLogged++;
            continue; // logged, counted, never forwarded — handoff §3.2B/§3.3
          }

          if (spamVerdict === null) {
            // Ambiguous — never silently bin. Alan gets a lighter-weight
            // notice than a confirmed new lead.
            await notify({
              clientId: integ.clientId,
              kind: "SYNC_FAILURE",
              title: "Form submission needs review",
              message: `A website form submission for ${integ.client.name} couldn't be confidently classified (${Math.round(verdict.confidence * 100)}% confidence) — check it in the admin panel.`,
              toClient: false,
            });
            continue;
          }

          // Confident real lead.
          await prisma.serviceLead.create({
            data: {
              clientId: integ.clientId,
              source: "WEBSITE_FORM",
              stage: "NEW",
              formSubmissionId: submission.id,
              gmailMessageId: meta.id,
              name: outcome.data.name,
              phone: outcome.data.phone,
              email: outcome.data.email,
              address: outcome.data.address,
              location: outcome.data.city,
              message: outcome.data.message,
              receivedAt: outcome.data.receivedAt,
            },
          });
          leadsCreated++;
          await notify({
            clientId: integ.clientId,
            kind: "NEW_LEAD",
            title: `New lead: ${outcome.data.name}${outcome.data.city ? ` (${outcome.data.city})` : ""}`,
            message: [outcome.data.phone, outcome.data.message].filter(Boolean).join(" — ").slice(0, 240),
            emailBody: [
              `${outcome.data.name} just asked for an estimate through your website.`,
              "",
              `Phone:    ${outcome.data.phone || "not given"}`,
              `Email:    ${outcome.data.email || "not given"}`,
              `Address:  ${outcome.data.address || "not given"}`,
              "",
              "What they need:",
              outcome.data.message || "(nothing written)",
              "",
              "Reply fast — most homeowners contact two or three painters before choosing one.",
              "",
              "This lead is also on your Leads page: https://portal.woodsascension.com/leads",
            ].join("\n"),
          });
        }
        } catch (err) {
          // A single malformed/unexpected message should never take down
          // the whole sync run for every other message and every other
          // client in this batch — log it, notify Alan, move on. The
          // message will be re-seen next run only via the time-window
          // fallback (history.list won't re-deliver it), which is
          // acceptable since gmailMessageId uniqueness makes re-processing
          // safe if it does come back around.
          await notify({
            clientId: integ.clientId,
            kind: "SYNC_FAILURE",
            title: "Gmail sync failure",
            message: `Unexpected error processing a Gmail message for ${integ.client.name}: ${err instanceof Error ? err.message : String(err)}`,
            toClient: false,
          });
        }
      }

      await prisma.clientIntegration.update({
        where: { id: integ.id },
        data: { config: { ...config, cursor: listResult.newCursor }, lastSyncAt: new Date(), status: "ACTIVE", lastError: null },
      });

      // Watchdog (handoff §3.2 "Watchdog"): if this client has produced no
      // form-derived FormSubmission rows (including spam) in the trailing
      // 7 days, notify Alan — but only once the integration itself has
      // been connected for at least 7 days, so a brand-new setup isn't
      // immediately flagged as "broken" before it's had a chance to
      // receive its first submission.
      const integrationAgeMs = Date.now() - integ.createdAt.getTime();
      if (integrationAgeMs >= WATCHDOG_GRACE_MS) {
        const recentCount = await prisma.formSubmission.count({
          where: { clientId: integ.clientId, receivedAt: { gte: new Date(Date.now() - WATCHDOG_WINDOW_MS) } },
        });
        if (recentCount === 0) {
          const recentWatchdogNotice = await prisma.notification.findFirst({
            where: { clientId: integ.clientId, kind: "WATCHDOG", createdAt: { gte: new Date(Date.now() - WATCHDOG_DEDUPE_MS) } },
          });
          if (!recentWatchdogNotice) {
            await notify({
              clientId: integ.clientId,
              kind: "WATCHDOG",
              title: "Website form may have stopped working",
              message: `No website form submissions (including spam) recorded for ${integ.client.name} in the last 7 days — worth checking the site's form is still sending.`,
              toClient: false,
            });
          }
        }
      }
    }

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        finishedAt: new Date(),
        status: "SUCCESS",
        detail: `${messagesProcessed} message(s) processed, ${leadsCreated} lead(s) created, ${spamLogged} spam logged, ${parseFailures} parse failure(s)`,
      },
    });

    return Response.json({ ok: true, messagesProcessed, leadsCreated, spamLogged, parseFailures });
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { finishedAt: new Date(), status: "FAILED", detail: err instanceof Error ? err.message : String(err) },
    });
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
