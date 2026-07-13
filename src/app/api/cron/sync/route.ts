import { prisma } from "@/lib/prisma";
import { fetchCampaignStatistics, fetchCampaignLeads, fetchLeadCategories } from "@/lib/smartlead";
import { dateKeyInTimezone, dateKeyToUtcMidnight } from "@/lib/timezone";
import { guessCompanyFromEmail } from "@/lib/format";

type DayBucket = {
  sends: number; // by SEND date
  totalReplies: number; // by REPLY date
  positiveReplies: number; // by REPLY date
  bounces: number; // by SEND date
  positiveReplyEmails: string[]; // by REPLY date
};

function emptyBucket(): DayBucket {
  return { sends: 0, totalReplies: 0, positiveReplies: 0, bounces: 0, positiveReplyEmails: [] };
}

function getBucket(map: Map<string, DayBucket>, key: string): DayBucket {
  let b = map.get(key);
  if (!b) {
    b = emptyBucket();
    map.set(key, b);
  }
  return b;
}

function getAudienceBucket(
  audienceBuckets: Map<string, Map<string, DayBucket>>,
  audienceId: string,
  key: string,
): DayBucket {
  let dateMap = audienceBuckets.get(audienceId);
  if (!dateMap) {
    dateMap = new Map();
    audienceBuckets.set(audienceId, dateMap);
  }
  return getBucket(dateMap, key);
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Self-heal: a prior run can be left stuck in RUNNING if its request was
  // killed mid-flight (e.g. a deploy rolled out during the ~50s sync). Mark
  // any RUNNING row older than 10 minutes as FAILED so the log stays honest.
  await prisma.syncRun.updateMany({
    where: { status: "RUNNING", startedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    data: { status: "FAILED", finishedAt: new Date(), detail: "Interrupted (likely a deploy during sync)" },
  });

  const syncRun = await prisma.syncRun.create({ data: { status: "RUNNING" } });

  try {
    const categories = await fetchLeadCategories();
    const positiveCategoryNames = new Set(
      categories.filter((c) => c.sentimentType === "positive").map((c) => c.name),
    );

    const clients = await prisma.client.findMany({
      where: { status: "ACTIVE" },
      include: { campaigns: { where: { active: true } } },
    });

    let campaignsSynced = 0;
    let daysUpserted = 0;
    let audienceDaysUpserted = 0;
    let positiveRepliesAdded = 0;

    for (const client of clients) {
      if (client.campaigns.length === 0) continue;

      const buckets = new Map<string, DayBucket>();
      // audienceId -> dateKey -> bucket
      const audienceBuckets = new Map<string, Map<string, DayBucket>>();
      // email (lowercased) -> candidate for auto-adding to the pipeline
      const positiveLeadCandidates = new Map<
        string,
        { name: string | null; audienceId: string | null; replyDate: Date | null }
      >();

      for (const campaign of client.campaigns) {
        const records = await fetchCampaignStatistics(
          campaign.smartleadCampaignId,
        );
        campaignsSynced++;

        for (const record of records) {
          const isPositive = !!(
            record.replyTime &&
            record.leadCategory &&
            positiveCategoryNames.has(record.leadCategory)
          );

          // SEND side — sends + bounces bucketed by the day the email was SENT.
          if (record.sentTime) {
            const sendKey = dateKeyInTimezone(new Date(record.sentTime), client.timezone);
            const b = getBucket(buckets, sendKey);
            b.sends += 1;
            if (record.isBounced) b.bounces += 1;
            if (campaign.audienceId) {
              const ab = getAudienceBucket(audienceBuckets, campaign.audienceId, sendKey);
              ab.sends += 1;
              if (record.isBounced) ab.bounces += 1;
            }
          }

          // REPLY side — replies + positives bucketed by the day the REPLY
          // came in (NOT the send date). This is the fix for the day-shifted
          // positive-reply counts — a reply belongs to the day it arrived.
          if (record.replyTime) {
            const replyKey = dateKeyInTimezone(new Date(record.replyTime), client.timezone);
            const b = getBucket(buckets, replyKey);
            b.totalReplies += 1;
            if (isPositive) {
              b.positiveReplies += 1;
              if (record.leadEmail) b.positiveReplyEmails.push(record.leadEmail);
            }
            if (campaign.audienceId) {
              const ab = getAudienceBucket(audienceBuckets, campaign.audienceId, replyKey);
              ab.totalReplies += 1;
              if (isPositive) {
                ab.positiveReplies += 1;
                if (record.leadEmail) ab.positiveReplyEmails.push(record.leadEmail);
              }
            }
          }

          // Auto-add positive replies to the pipeline (v1.1) — deduped by
          // email against existing entries after the campaign loop below.
          if (isPositive && record.leadEmail) {
            const emailKey = record.leadEmail.toLowerCase();
            if (!positiveLeadCandidates.has(emailKey)) {
              positiveLeadCandidates.set(emailKey, {
                name: record.leadName,
                audienceId: campaign.audienceId,
                replyDate: record.replyTime ? new Date(record.replyTime) : null,
              });
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      if (positiveLeadCandidates.size > 0) {
        const existing = await prisma.pipelineEntry.findMany({
          where: { clientId: client.id, email: { in: [...positiveLeadCandidates.keys()] } },
          select: { id: true, email: true, positiveReplyDate: true },
        });
        const existingEmails = new Set(existing.map((e) => e.email!.toLowerCase()));

        // Backfill positiveReplyDate on already-existing entries that are
        // missing it (they were auto-added before we captured the reply date).
        for (const e of existing) {
          if (e.positiveReplyDate) continue;
          const cand = positiveLeadCandidates.get(e.email!.toLowerCase());
          if (cand?.replyDate) {
            await prisma.pipelineEntry.update({
              where: { id: e.id },
              data: { positiveReplyDate: cand.replyDate },
            });
          }
        }

        const toCreate = [...positiveLeadCandidates.entries()].filter(
          ([email]) => !existingEmails.has(email),
        );

        if (toCreate.length > 0) {
          // Smartlead's /leads endpoint (unlike /statistics) carries the
          // lead's actual entered company name — pull it in for the leads
          // we're about to create so the pipeline shows "Sage Advisors"
          // instead of a domain-derived "Sageadvisors".
          const companyByEmail = new Map<string, string>();
          for (const campaign of client.campaigns) {
            try {
              const leads = await fetchCampaignLeads(campaign.smartleadCampaignId);
              for (const lead of leads) {
                if (lead.companyName && lead.companyName.trim().length > 0) {
                  companyByEmail.set(lead.email.toLowerCase(), lead.companyName.trim());
                }
              }
            } catch {
              // Non-fatal — fall back to the guessed name for this campaign's leads.
            }
          }

          await prisma.pipelineEntry.createMany({
            data: toCreate.map(([email, lead]) => ({
              clientId: client.id,
              audienceId: lead.audienceId,
              stage: "STAGE_1" as const,
              contactName: lead.name && lead.name.trim().length > 0 ? lead.name : email,
              email,
              company: companyByEmail.get(email) ?? guessCompanyFromEmail(email),
              positiveReplyDate: lead.replyDate,
              notes: "Auto-added from a positive Smartlead reply",
            })),
          });
          positiveRepliesAdded += toCreate.length;
        }
      }

      // apptsBooked rollup: entries that reached STAGE_2 (Appointment
      // Booked equivalent), bucketed by the day they reached that stage —
      // both client-level and, when tagged, audience-level.
      const bookedEntries = await prisma.pipelineEntry.findMany({
        where: { clientId: client.id, stage: "STAGE_2" },
        select: { updatedAt: true, audienceId: true },
      });
      const apptsByDay = new Map<string, number>();
      const apptsByAudienceDay = new Map<string, Map<string, number>>();
      for (const entry of bookedEntries) {
        const dateKey = dateKeyInTimezone(entry.updatedAt, client.timezone);
        apptsByDay.set(dateKey, (apptsByDay.get(dateKey) ?? 0) + 1);

        if (entry.audienceId) {
          const dateMap = apptsByAudienceDay.get(entry.audienceId) ?? new Map();
          dateMap.set(dateKey, (dateMap.get(dateKey) ?? 0) + 1);
          apptsByAudienceDay.set(entry.audienceId, dateMap);
        }
      }
      for (const [dateKey] of apptsByDay) {
        getBucket(buckets, dateKey); // ensure a row exists for appointment-only days
      }

      for (const [dateKey, bucket] of buckets) {
        await prisma.dailyStat.upsert({
          where: { clientId_date: { clientId: client.id, date: dateKeyToUtcMidnight(dateKey) } },
          create: {
            clientId: client.id,
            date: dateKeyToUtcMidnight(dateKey),
            sends: bucket.sends,
            totalReplies: bucket.totalReplies,
            positiveReplies: bucket.positiveReplies,
            bounces: bucket.bounces,
            apptsBooked: apptsByDay.get(dateKey) ?? 0,
            positiveReplyEmails: bucket.positiveReplyEmails,
          },
          update: {
            sends: bucket.sends,
            totalReplies: bucket.totalReplies,
            positiveReplies: bucket.positiveReplies,
            bounces: bucket.bounces,
            apptsBooked: apptsByDay.get(dateKey) ?? 0,
            positiveReplyEmails: bucket.positiveReplyEmails,
          },
        });
        daysUpserted++;
      }

      for (const [audienceId, dateMap] of audienceBuckets) {
        const apptsByDayForAudience = apptsByAudienceDay.get(audienceId) ?? new Map();
        for (const [dateKey, bucket] of dateMap) {
          await prisma.audienceDailyStat.upsert({
            where: { audienceId_date: { audienceId, date: dateKeyToUtcMidnight(dateKey) } },
            create: {
              audienceId,
              date: dateKeyToUtcMidnight(dateKey),
              sends: bucket.sends,
              totalReplies: bucket.totalReplies,
              positiveReplies: bucket.positiveReplies,
              bounces: bucket.bounces,
              apptsBooked: apptsByDayForAudience.get(dateKey) ?? 0,
              positiveReplyEmails: bucket.positiveReplyEmails,
            },
            update: {
              sends: bucket.sends,
              totalReplies: bucket.totalReplies,
              positiveReplies: bucket.positiveReplies,
              bounces: bucket.bounces,
              apptsBooked: apptsByDayForAudience.get(dateKey) ?? 0,
              positiveReplyEmails: bucket.positiveReplyEmails,
            },
          });
          audienceDaysUpserted++;
        }
      }
    }

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        finishedAt: new Date(),
        status: "SUCCESS",
        detail: `${campaignsSynced} campaign(s), ${daysUpserted} day(s) upserted, ${audienceDaysUpserted} audience-day(s) upserted, ${positiveRepliesAdded} lead(s) auto-added to pipeline`,
      },
    });

    return Response.json({ ok: true, campaignsSynced, daysUpserted, audienceDaysUpserted, positiveRepliesAdded });
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        finishedAt: new Date(),
        status: "FAILED",
        detail: err instanceof Error ? err.message : String(err),
      },
    });
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
