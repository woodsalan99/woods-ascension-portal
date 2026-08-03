import { prisma } from "@/lib/prisma";
import { openJson } from "@/lib/crypto";
import { fetchPlaceDetails } from "@/lib/places";
import { notify } from "@/lib/notify";
import { dateKeyInTimezone, dateKeyToUtcMidnight } from "@/lib/timezone";

// Daily: review count + rating -> ReviewSnapshot (one row per day, so the
// month-over-month movement is derivable), plus the most recent reviews
// -> ReviewItem. Same shell as the other cron routes.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await prisma.syncRun.updateMany({
    where: { status: "RUNNING", source: "PLACES", startedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    data: { status: "FAILED", finishedAt: new Date(), detail: "Interrupted (likely a deploy during sync)" },
  });

  const syncRun = await prisma.syncRun.create({ data: { status: "RUNNING", source: "PLACES" } });

  let snapshots = 0;
  let reviewsUpserted = 0;

  try {
    const integrations = await prisma.clientIntegration.findMany({
      where: { provider: "GOOGLE_PLACES", status: "ACTIVE", client: { status: "ACTIVE", type: "LOCAL_SERVICES" } },
      include: { client: true },
    });

    for (const integ of integrations) {
      const config = integ.config as { placeId?: string };
      if (!config.placeId) continue;

      let apiKey: string;
      try {
        ({ apiKey } = openJson<{ apiKey: string }>(integ.credentials));
      } catch (err) {
        await prisma.clientIntegration.update({
          where: { id: integ.id },
          data: { status: "ERROR", lastError: `Failed to decrypt credentials: ${err instanceof Error ? err.message : String(err)}` },
        });
        continue;
      }

      try {
        const { summary, reviews } = await fetchPlaceDetails({ apiKey, placeId: config.placeId });

        // One snapshot per calendar day in the client's timezone.
        const dateKey = dateKeyInTimezone(new Date(), integ.client.timezone);
        const date = dateKeyToUtcMidnight(dateKey);
        await prisma.reviewSnapshot.upsert({
          where: { clientId_date: { clientId: integ.clientId, date } },
          create: { clientId: integ.clientId, date, count: summary.reviewCount, rating: summary.rating ?? 0 },
          update: { count: summary.reviewCount, rating: summary.rating ?? 0 },
        });
        snapshots++;

        for (const r of reviews) {
          // Places gives no stable review id, so identity is
          // (client, author, publishedAt) — see the ReviewItem model.
          const existing = await prisma.reviewItem.findFirst({
            where: { clientId: integ.clientId, author: r.author, reviewedAt: r.publishedAt },
          });
          if (existing) {
            await prisma.reviewItem.update({ where: { id: existing.id }, data: { rating: r.rating, text: r.text } });
          } else {
            await prisma.reviewItem.create({
              data: {
                clientId: integ.clientId,
                author: r.author,
                rating: r.rating,
                text: r.text,
                reviewedAt: r.publishedAt,
              },
            });
          }
          reviewsUpserted++;
        }

        await prisma.clientIntegration.update({
          where: { id: integ.id },
          data: { lastSyncAt: new Date(), status: "ACTIVE", lastError: null },
        });
      } catch (err) {
        await prisma.clientIntegration.update({
          where: { id: integ.id },
          data: { status: "ERROR", lastError: err instanceof Error ? err.message : String(err) },
        });
        await notify({
          clientId: integ.clientId,
          kind: "SYNC_FAILURE",
          title: "Google reviews sync failure",
          message: `Couldn't read reviews for ${integ.client.name}: ${err instanceof Error ? err.message : String(err)}`,
          toClient: false,
        });
      }
    }

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        finishedAt: new Date(),
        status: "SUCCESS",
        detail: `${snapshots} snapshot(s), ${reviewsUpserted} review(s) upserted`,
      },
    });
    return Response.json({ ok: true, snapshots, reviewsUpserted });
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { finishedAt: new Date(), status: "FAILED", detail: err instanceof Error ? err.message : String(err) },
    });
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
