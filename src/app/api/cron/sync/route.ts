import { prisma } from "@/lib/prisma";
import { fetchCampaignStatistics, fetchLeadCategories } from "@/lib/smartlead";
import { dateKeyInTimezone, dateKeyToUtcMidnight } from "@/lib/timezone";

type DayBucket = {
  sends: number;
  totalReplies: number;
  positiveReplies: number;
  bounces: number;
};

function emptyBucket(): DayBucket {
  return { sends: 0, totalReplies: 0, positiveReplies: 0, bounces: 0 };
}

function applyRecord(bucket: DayBucket, positiveCategoryNames: Set<string>, record: {
  replyTime: string | null;
  leadCategory: string | null;
  isBounced: boolean;
}) {
  bucket.sends += 1;
  if (record.replyTime) {
    bucket.totalReplies += 1;
    if (record.leadCategory && positiveCategoryNames.has(record.leadCategory)) {
      bucket.positiveReplies += 1;
    }
  }
  if (record.isBounced) bucket.bounces += 1;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

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

    for (const client of clients) {
      if (client.campaigns.length === 0) continue;

      const buckets = new Map<string, DayBucket>();
      // audienceId -> dateKey -> bucket
      const audienceBuckets = new Map<string, Map<string, DayBucket>>();

      for (const campaign of client.campaigns) {
        const records = await fetchCampaignStatistics(
          campaign.smartleadCampaignId,
        );
        campaignsSynced++;

        for (const record of records) {
          if (!record.sentTime) continue;
          const dateKey = dateKeyInTimezone(
            new Date(record.sentTime),
            client.timezone,
          );

          const bucket = buckets.get(dateKey) ?? emptyBucket();
          applyRecord(bucket, positiveCategoryNames, record);
          buckets.set(dateKey, bucket);

          if (campaign.audienceId) {
            const dateMap = audienceBuckets.get(campaign.audienceId) ?? new Map();
            const audienceBucket = dateMap.get(dateKey) ?? emptyBucket();
            applyRecord(audienceBucket, positiveCategoryNames, record);
            dateMap.set(dateKey, audienceBucket);
            audienceBuckets.set(campaign.audienceId, dateMap);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
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
        const bucket = buckets.get(dateKey) ?? emptyBucket();
        buckets.set(dateKey, bucket);
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
          },
          update: {
            sends: bucket.sends,
            totalReplies: bucket.totalReplies,
            positiveReplies: bucket.positiveReplies,
            bounces: bucket.bounces,
            apptsBooked: apptsByDay.get(dateKey) ?? 0,
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
            },
            update: {
              sends: bucket.sends,
              totalReplies: bucket.totalReplies,
              positiveReplies: bucket.positiveReplies,
              bounces: bucket.bounces,
              apptsBooked: apptsByDayForAudience.get(dateKey) ?? 0,
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
        detail: `${campaignsSynced} campaign(s), ${daysUpserted} day(s) upserted, ${audienceDaysUpserted} audience-day(s) upserted`,
      },
    });

    return Response.json({ ok: true, campaignsSynced, daysUpserted, audienceDaysUpserted });
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
