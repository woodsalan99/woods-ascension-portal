import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Prior-30-days comparisons for the Overview's status strip and KPI trend
// arrows. Deliberately NOT built on the override-capable resolver layer in
// ls-metrics.ts — these are dashboard deltas, not numbers a client would
// ever need to correct by hand, and "compare to the prior window" isn't a
// concept that grammar was built to express. See D54.

// Same rule every other lead count on the site uses: deleted and bad-fit
// leads don't count.
const LEAD_COUNTS: Prisma.ServiceLeadWhereInput = { deletedAt: null, OR: [{ qualified: null }, { qualified: true }] };

export type CountTrend = { current: number; prior: number | null; deltaPct: number | null };
export type CplTrend = { current: number; prior: number | null; deltaPct: number | null; month: string };
export type PagesTrend = { indexed: number; total: number; delta: number | null };
export type ReviewsTrend = { count: number; rating: number | null; delta: number | null };

export type OverviewTrends = {
  leads: CountTrend;
  costPerLead: CplTrend | null;
  pages: PagesTrend;
  reviews: ReviewsTrend;
};

function pct(current: number, prior: number): number | null {
  // A move from 0 has no percentage — "up from nothing" isn't a rate.
  if (prior === 0) return null;
  return Math.round(((current - prior) / prior) * 100);
}

export async function getOverviewTrends(clientId: string, now = new Date()): Promise<OverviewTrends> {
  const curStart = new Date(now.getTime() - 30 * 86_400_000);
  const priorStart = new Date(now.getTime() - 60 * 86_400_000);

  const [
    curLeads,
    priorLeads,
    lsaMonths,
    pagesIndexed,
    pagesTotal,
    pagesIndexedByCutoff,
    earliestIndexedAt,
    latestReview,
    priorReview,
  ] = await Promise.all([
    prisma.serviceLead.count({ where: { clientId, ...LEAD_COUNTS, receivedAt: { gte: curStart, lt: now } } }),
    prisma.serviceLead.count({ where: { clientId, ...LEAD_COUNTS, receivedAt: { gte: priorStart, lt: curStart } } }),
    prisma.lsaMonthlyStat.findMany({ where: { clientId }, orderBy: { month: "desc" }, take: 2 }),
    prisma.sitePage.count({ where: { clientId, indexed: true } }),
    prisma.sitePage.count({ where: { clientId } }),
    // "Indexed as of 30 days ago" assumes a page never goes back to
    // unindexed once Google's picked it up — true in practice, and the
    // only thing SitePage.indexedAt can actually tell us.
    prisma.sitePage.count({ where: { clientId, indexed: true, indexedAt: { lt: curStart } } }),
    prisma.sitePage.findFirst({ where: { clientId, indexed: true }, orderBy: { indexedAt: "asc" }, select: { indexedAt: true } }),
    prisma.reviewSnapshot.findFirst({ where: { clientId }, orderBy: { date: "desc" } }),
    prisma.reviewSnapshot.findFirst({ where: { clientId, date: { lt: curStart } }, orderBy: { date: "desc" } }),
  ]);

  // indexedAt records when the SYNC first observed a page as indexed, not
  // when Google actually indexed it. The first time GSC ever ran, every
  // page's indexedAt landed on that one day — so on a brand-new connection
  // the "prior" count is always 0 and the delta would claim every page went
  // live in the last 30 days, which is false. Suppress the trend until the
  // earliest indexedAt on file actually predates the comparison window.
  // Same principle as the reviews backfill: don't display history we never
  // measured. See D54.
  const hasRealPageHistory = earliestIndexedAt?.indexedAt != null && earliestIndexedAt.indexedAt < curStart;

  let costPerLead: CplTrend | null = null;
  if (lsaMonths[0] && lsaMonths[0].chargedLeads > 0) {
    const cur = lsaMonths[0].spendCents / lsaMonths[0].chargedLeads / 100;
    const prior =
      lsaMonths[1] && lsaMonths[1].chargedLeads > 0 ? lsaMonths[1].spendCents / lsaMonths[1].chargedLeads / 100 : null;
    costPerLead = {
      current: cur,
      prior,
      deltaPct: prior !== null ? pct(cur, prior) : null,
      month: lsaMonths[0].month,
    };
  }

  return {
    leads: { current: curLeads, prior: priorLeads, deltaPct: pct(curLeads, priorLeads) },
    costPerLead,
    pages: { indexed: pagesIndexed, total: pagesTotal, delta: hasRealPageHistory ? pagesIndexed - pagesIndexedByCutoff : null },
    reviews: {
      count: latestReview?.count ?? 0,
      rating: latestReview?.rating ?? null,
      delta: latestReview && priorReview ? latestReview.count - priorReview.count : null,
    },
  };
}

// The three status-strip verdicts. Kept as plain rules, not thresholds
// tuned per client — if a real client needs a different bar later, that's
// the moment to make it configurable, not before.
export type StatusState = "good" | "attention" | "neutral";

export function leadFlowStatus(t: OverviewTrends): StatusState {
  return t.leads.current > 0 ? "good" : "attention";
}

// Ties to the same 30-day delta used for the trend arrow: flat reviews over
// a month is worth flagging even when the rating itself is excellent —
// Canencia's real situation (34 reviews, unmoved) is exactly this case.
export function reviewsStatus(t: OverviewTrends): StatusState {
  if (t.reviews.delta === null) return "neutral"; // not enough history yet
  return t.reviews.delta > 0 ? "good" : "attention";
}

export function pagesStatus(t: OverviewTrends): StatusState {
  if (t.pages.total === 0) return "neutral";
  return t.pages.indexed === t.pages.total ? "good" : "neutral";
}
