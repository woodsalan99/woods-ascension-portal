import { prisma } from "@/lib/prisma";
import { openJson } from "@/lib/crypto";
import { fetchDailyStats, fetchPagesWithImpressions, normalizeUrl } from "@/lib/gsc";
import { notify } from "@/lib/notify";
import { dateKeyToUtcMidnight } from "@/lib/timezone";

// Daily. Two jobs:
//   1. Daily clicks/impressions -> GscDailyStat
//   2. Which pages Google is actually showing -> SitePage.indexed
//
// On a first run (no cursor) this pulls 16 months, which is as far back as
// Search Console keeps data — so history arrives free rather than starting
// from the day we connected.
const FIRST_RUN_DAYS = 480;
const INCREMENTAL_DAYS = 30;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await prisma.syncRun.updateMany({
    where: { status: "RUNNING", source: "GSC", startedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    data: { status: "FAILED", finishedAt: new Date(), detail: "Interrupted (likely a deploy during sync)" },
  });

  const syncRun = await prisma.syncRun.create({ data: { status: "RUNNING", source: "GSC" } });

  let daysUpserted = 0;
  let pagesMarkedIndexed = 0;

  try {
    const integrations = await prisma.clientIntegration.findMany({
      where: { provider: "GSC", status: "ACTIVE", client: { status: "ACTIVE", type: "LOCAL_SERVICES" } },
      include: { client: true },
    });

    for (const integ of integrations) {
      const config = integ.config as { siteUrl?: string; backfilled?: boolean };
      if (!config.siteUrl) continue;

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

      try {
        // Search Analytics lags ~2 days; asking for today returns nothing.
        const end = new Date(Date.now() - 2 * 86400000);
        const span = config.backfilled ? INCREMENTAL_DAYS : FIRST_RUN_DAYS;
        const start = new Date(end.getTime() - span * 86400000);

        const rows = await fetchDailyStats({
          refreshToken,
          siteUrl: config.siteUrl,
          startDate: ymd(start),
          endDate: ymd(end),
        });

        for (const r of rows) {
          if (!r.date) continue;
          const date = dateKeyToUtcMidnight(r.date);
          await prisma.gscDailyStat.upsert({
            where: { clientId_date: { clientId: integ.clientId, date } },
            create: { clientId: integ.clientId, date, clicks: r.clicks, impressions: r.impressions },
            update: { clicks: r.clicks, impressions: r.impressions },
          });
          daysUpserted++;
        }

        // A page that has appeared in search results at all is indexed —
        // simpler and far cheaper than per-URL inspection calls.
        const seen = await fetchPagesWithImpressions({
          refreshToken,
          siteUrl: config.siteUrl,
          startDate: ymd(start),
          endDate: ymd(end),
        });
        const pages = await prisma.sitePage.findMany({ where: { clientId: integ.clientId } });
        for (const p of pages) {
          const hit = seen.get(normalizeUrl(p.url));
          if (hit && !p.indexed) {
            await prisma.sitePage.update({
              where: { id: p.id },
              data: { indexed: true, indexedAt: new Date(), lastCheckedAt: new Date() },
            });
            pagesMarkedIndexed++;
          } else {
            await prisma.sitePage.update({ where: { id: p.id }, data: { lastCheckedAt: new Date() } });
          }
        }

        await prisma.clientIntegration.update({
          where: { id: integ.id },
          data: {
            config: { ...config, backfilled: true },
            lastSyncAt: new Date(),
            status: "ACTIVE",
            lastError: null,
          },
        });
      } catch (err) {
        await prisma.clientIntegration.update({
          where: { id: integ.id },
          data: { status: "ERROR", lastError: err instanceof Error ? err.message : String(err) },
        });
        await notify({
          clientId: integ.clientId,
          kind: "SYNC_FAILURE",
          title: "Search Console sync failure",
          message: `Couldn't read Search Console for ${integ.client.name}: ${err instanceof Error ? err.message : String(err)}`,
          toClient: false,
        });
      }
    }

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        finishedAt: new Date(),
        status: "SUCCESS",
        detail: `${daysUpserted} day(s) upserted, ${pagesMarkedIndexed} page(s) newly showing on Google`,
      },
    });
    return Response.json({ ok: true, daysUpserted, pagesMarkedIndexed });
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: { finishedAt: new Date(), status: "FAILED", detail: err instanceof Error ? err.message : String(err) },
    });
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
