import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { openJson } from "@/lib/crypto";
import { listNewMessages, getMessage, type GmailCursor } from "@/lib/gmail";
import { lsaMatcher, formMatcher, talkrouteMatcher, type GmailMatcherConfig } from "@/lib/gmail-parsers";
import { classifySpam } from "@/lib/spam-classify";
import { notify } from "@/lib/notify";

// Where a client goes to act on a Google Ads lead, and where the sign-in
// details for it live. The password is only ever a LINK — never stored in
// or sent by the portal. See D49.
const LSA_CONSOLE_URL = "https://business.google.com/us/ad-solutions/local-service-ads/";
const LSA_CREDENTIALS_URL =
  "https://docs.google.com/document/d/1bULpMBD8zBPGpT6XrrpzyrSis8YCl67Np9tJsQIy6pc/edit?tab=t.0";
const LEADS_URL = "https://portal.woodsascension.com/leads";
import { recordContact, normalizePhone } from "@/lib/lead-identity";

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
      // Known-kind messages this client couldn't prove it owns. Reported to
      // Alan once per run rather than per message, so a misconfigured
      // identifier doesn't turn into a notification storm. See D56.
      const unattributed: { provider: string; messageId: string; subject: string }[] = [];

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

        // TENANCY GATE. One inbox receives mail for every client, so
        // "is this an LSA email?" is not the same question as "is this MY
        // client's LSA email?". Before D56 only the form matcher asked the
        // second one, and a Pamalu voicemail was announced to Canencia's
        // owners. Anything of a known kind that this client cannot prove
        // ownership of is refused here — and reported to Alan only, so a
        // mis-set config surfaces as an alert instead of silently eating
        // real leads.
        {
          const kind = lsaMatcher.matches(meta, config)
            ? lsaMatcher
            : talkrouteMatcher.matches(meta, config)
              ? talkrouteMatcher
              : formMatcher.matches(meta, config)
                ? formMatcher
                : null;
          if (kind && !kind.belongsToClient(meta, { text }, config)) {
            unattributed.push({ provider: kind.provider, messageId: meta.id, subject: meta.subject });
            continue;
          }
        }

        try {
        if (lsaMatcher.matches(meta, config)) {
          const existing = await prisma.serviceLead.findUnique({ where: { gmailMessageId: meta.id } });
          if (existing) continue;

          const outcome = lsaMatcher.parse({ text }, meta);
          if (!outcome.ok) parseFailures++;
          const d = outcome.ok ? outcome.data : null;

          // Google's "customer sent you a message" variant usually carries
          // the phone number, and arrives AFTER the original request from
          // the same person — so merge on it rather than creating a second
          // card for the same customer.
          const lsaResult = await recordContact({
            clientId: integ.clientId,
            identity: { phone: d?.phone ?? null, name: d?.name ?? null },
            event: {
              type: "LSA_REQUEST",
              dedupeKey: `gmail:${meta.id}`,
              occurredAt: d?.receivedAt ?? new Date(meta.internalDate),
              summary: d
                ? d.variant === "CALL"
                  ? `Called through Google Ads${d.calledAt ? ` on ${d.calledAt}` : ""} — details only visible in the Google Ads account`
                  : d.variant === "MESSAGE"
                    ? `Google Ads customer replied: ${d.message ?? "(no text)"}`.slice(0, 200)
                    : `Google Ads request — ${[d.serviceType, d.location].filter(Boolean).join(" · ") || "no details given"}`
                : "Google Ads lead that couldn't be read automatically — check Gmail",
              meta: { gmailMessageId: meta.id, variant: d?.variant ?? "UNPARSED" },
            },
            create: {
              source: "LSA",
              stage: "NEW",
              gmailMessageId: meta.id,
              name: d?.name ?? null,
              phone: d?.phone ?? null,
              location: d?.location ?? null,
              serviceType: d?.serviceType ?? null,
              message:
                d?.message ??
                (outcome.ok
                  ? null
                  : `(Could not parse this LSA email automatically — check Gmail directly. Reason: ${outcome.reason})`),
              // Google withholds the customer's name/number on a new
              // request until you reply. On the customer-message variant
              // they've often just given a number — so only flag
              // needs-details when we genuinely don't have one.
              needsDetails: !d?.phone,
              receivedAt: d?.receivedAt ?? new Date(meta.internalDate),
            },
            // A later message from the same person can fill in what the
            // original hidden-details request couldn't.
            enrich: { phone: d?.phone ?? null, name: d?.name ?? null, location: d?.location ?? null, serviceType: d?.serviceType ?? null },
          });
          if (lsaResult.isNewLead) leadsCreated++;

          const lsa = outcome.ok ? outcome.data : null;
          const lsaWhere = [lsa?.serviceType, lsa?.location].filter(Boolean).join(" · ");
          const isCall = lsa?.variant === "CALL";

          // Wording specified by Alan. Google gives no way to know from the
          // email whether Desiree picked the call up, so the notification
          // says so plainly instead of guessing — it opens with the escape
          // hatch for the person who already handled it. See D52.
          const what = isCall
            ? `A customer CALLED you${lsa?.calledAt ? ` on ${lsa.calledAt}` : ""}.`
            : lsa?.phone
              ? `Their number is ${lsa.phone}.`
              : "They sent a message through Google.";

          const pushover = [
            "New lead from Google Ads.",
            what,
            lsa?.message ? `They said: ${lsa.message}` : null,
            "Desiree — if you already answered, ignore this.",
            "Otherwise: if it was a message, reply or call them. If it was a missed call, call them back.",
            `Log in to Google Ads: ${LSA_CONSOLE_URL}`,
            `Account details to log in with: ${LSA_CREDENTIALS_URL}`,
          ]
            .filter(Boolean)
            .join(" ");

          await notify({
            clientId: integ.clientId,
            kind: "NEW_LEAD",
            title: isCall
              ? "Google Ads — customer called"
              : lsa?.phone
                ? `Google Ads lead — ${lsa.phone}`
                : "Google Ads — new message",
            message: pushover.slice(0, 900),
            // Deliberately does NOT forward Google's original email. It is
            // almost entirely tracking links, a customer ID, a Dublin postal
            // address and a mandatory-service-announcement footer — the one
            // fact in it is the line we already extracted. Pasting it under
            // the summary was what made this unreadable.
            emailBody: [
              isCall
                ? `A Google Ads customer called you${lsa?.calledAt ? ` on ${lsa.calledAt}` : ""}.`
                : lsa?.phone
                  ? `A Google Ads customer got in touch. Their number is ${lsa.phone}.`
                  : "A Google Ads customer sent you a message.",
              "",
              lsaWhere ? `Job:      ${lsaWhere}` : null,
              lsa?.phone ? `Phone:    ${lsa.phone}` : null,
              lsa?.name ? `Name:     ${lsa.name}` : null,
              lsa?.message ? "" : null,
              lsa?.message ? "What they said:" : null,
              lsa?.message ?? null,
              "",
              "WHAT TO DO",
              "Desiree — if you already answered this one, nothing to do.",
              isCall
                ? "Otherwise, call them back. Google doesn't send us their number, so you'll need to open the account below to get it."
                : "Otherwise, reply to them or give them a call. Google keeps their details hidden until you reply.",
              "",
              `Log in to Google Ads:  ${LSA_CONSOLE_URL}`,
              `Account details:       ${LSA_CREDENTIALS_URL}`,
              "",
              `This lead is also on your Leads page: ${LEADS_URL}`,
            ]
              .filter((line) => line !== null)
              .join("\n"),
          });
          continue;
        }

        // TalkRoute voicemail — the transcription email. Order of arrival is
        // NOT reliable: in the real test the voicemail email landed two
        // minutes BEFORE Google's call email, so a "wait after the call"
        // check would have missed it. Instead both directions correlate:
        // this block adopts a recent phone-less Google Ads call lead if one
        // exists, and hands the lead its number — and because the LSA block
        // enriches by phone, a voicemail processed first is found by the
        // later call email through the normal phone merge. See D53.
        if (talkrouteMatcher.matches(meta, config)) {
          const outcome = talkrouteMatcher.parse({ text }, meta);
          if (!outcome.ok) {
            parseFailures++;
            continue;
          }
          const vm = outcome.data;

          // A Google Ads call lead with no number, within ±90 minutes, is
          // almost certainly this same call. Give it the number FIRST so
          // recordContact's phone match lands on it instead of creating a
          // twin.
          if (vm.phone) {
            const orphan = await prisma.serviceLead.findFirst({
              where: {
                clientId: integ.clientId,
                source: "LSA",
                phone: null,
                deletedAt: null,
                receivedAt: {
                  gte: new Date(vm.receivedAt.getTime() - 90 * 60_000),
                  lte: new Date(vm.receivedAt.getTime() + 90 * 60_000),
                },
              },
              orderBy: { receivedAt: "desc" },
            });
            if (orphan) {
              await prisma.serviceLead.update({
                where: { id: orphan.id },
                data: {
                  phone: vm.phone,
                  phoneNormalized: normalizePhone(vm.phone),
                  needsDetails: false,
                  message: orphan.message ?? vm.transcript,
                },
              });
            }
          }

          const vmResult = await recordContact({
            clientId: integ.clientId,
            identity: { phone: vm.phone },
            event: {
              type: "VOICEMAIL",
              dedupeKey: `vm:${meta.id}`,
              occurredAt: vm.receivedAt,
              summary: `Voicemail${vm.lengthSec ? ` (${vm.lengthSec}s)` : ""}: ${vm.transcript ?? "(no transcription)"}`.slice(0, 300),
              meta: { gmailMessageId: meta.id, transcript: vm.transcript, lengthSec: vm.lengthSec },
            },
            create: {
              source: "GBP_CALL",
              stage: "NEW",
              phone: vm.phone,
              message: vm.transcript,
              receivedAt: vm.receivedAt,
            },
            enrich: { phone: vm.phone },
          });
          if (vmResult.isNewLead) leadsCreated++;

          if (vmResult.isNewEvent) {
            const who = vmResult.lead.name ?? vm.phone ?? "a caller";
            await notify({
              clientId: integ.clientId,
              kind: "NEW_LEAD",
              title: `Voicemail — ${who}`,
              message: [
                `${who} left a voicemail${vm.lengthSec ? ` (${vm.lengthSec}s)` : ""}.`,
                vm.transcript ? `They said: "${vm.transcript}"` : null,
                vm.phone ? `Call them back: ${vm.phone}` : null,
              ]
                .filter(Boolean)
                .join(" ")
                .slice(0, 900),
              emailBody: [
                `${who} left a voicemail${vm.lengthSec ? ` (${vm.lengthSec} seconds)` : ""}.`,
                "",
                vm.transcript ? "What they said:" : null,
                vm.transcript ? `"${vm.transcript}"` : null,
                "",
                vm.phone ? `Call them back: ${vm.phone}` : "TalkRoute didn't include their number — check the TalkRoute app.",
                "",
                `This lead is also on your Leads page: ${LEADS_URL}`,
              ]
                .filter((line) => line !== null)
                .join("\n"),
            });
          }
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

          // With no message there is nothing for the model to judge, and it
          // reliably calls that spam at high confidence — which would bin a
          // real homeowner who filled in their name and number and skipped
          // the box. No message means no confident verdict, full stop.
          // See D50.
          const hasMessage = (outcome.data.message ?? "").trim().length >= 3;
          const confident = hasMessage && verdict.confidence >= SPAM_CONFIDENCE_THRESHOLD;
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

          // Confident real lead. Merges onto an existing card when this
          // person has already called or submitted before.
          const formResult = await recordContact({
            clientId: integ.clientId,
            identity: { phone: outcome.data.phone, name: outcome.data.name },
            event: {
              type: "FORM",
              dedupeKey: `gmail:${meta.id}`,
              occurredAt: outcome.data.receivedAt,
              summary: `Website form: ${outcome.data.message || "(nothing written)"}`.slice(0, 200),
              meta: { gmailMessageId: meta.id, formSubmissionId: submission.id, page: outcome.data.page },
            },
            create: {
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
            enrich: {
              name: outcome.data.name,
              phone: outcome.data.phone,
              email: outcome.data.email,
              location: outcome.data.city,
            },
          });
          if (formResult.isNewLead) leadsCreated++;
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
              `This lead is also on your Leads page: ${LEADS_URL}`,
              "",
              // The original, so nothing is lost in the parsing and they can
              // see exactly what the person typed. Only sent for submissions
              // that PASSED the spam check — the whole point is that junk
              // never reaches their inbox. See D49.
              "----- The original message from your website -----",
              text.slice(0, 4000),
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

      // Admin-only: something arrived that looks like a real lead but could
      // not be tied to this client. Either it belongs to a different client
      // (correct to refuse) or this client's identifier is unset/wrong (needs
      // fixing) — both need Alan's eyes, neither should reach the client.
      if (unattributed.length > 0) {
        const byProvider = [...new Set(unattributed.map((u) => u.provider))].join(", ");
        await notify({
          clientId: integ.clientId,
          kind: "SYNC_FAILURE",
          title: `${unattributed.length} message(s) not claimed by ${integ.client.name}`,
          message:
            `${unattributed.length} ${byProvider} message(s) reached the shared inbox but couldn't be confirmed as ${integ.client.name}'s, so no lead was created and nobody was notified. ` +
            `If these are genuinely theirs, set the matching identifier on their Gmail integration. Subjects: ` +
            unattributed.slice(0, 5).map((u) => `"${u.subject}"`).join(", "),
          toClient: false,
        });
      }

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
