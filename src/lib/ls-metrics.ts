import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { monthKeyInTimezone, formatMonthKey } from "@/lib/timezone";

export type ResolvedMetric = {
  scopeKey: string;
  display: string; // what renders: "$22", "34", "11 of 18"
  liveDisplay: string; // ALWAYS computed, even when overridden — powers the "live value is X" badge
  overridden: boolean;
  source: string; // "Google Ads (manual entry)" | "CallRail" | "Local Falcon" | "Leads board" ...
  asOf: Date | null;
};

type ResolverCtx = { clientId: string; tz: string };
type ResolverResult = { display: string; source: string; asOf: Date | null };
type Resolver = (ctx: ResolverCtx, period: string | null) => Promise<ResolverResult>;

// scopeKey grammar: "domain.metric[:period]" — period is a client-TZ month
// key ("2026-07") or absent for "current/live". See IMPLEMENTATION_STATE.md §3c.
function splitKey(scopeKey: string): [string, string | null] {
  const i = scopeKey.indexOf(":");
  return i === -1 ? [scopeKey, null] : [scopeKey.slice(0, i), scopeKey.slice(i + 1)];
}

// A period is either a calendar month ("2026-07") or the rolling window
// "last30". The rolling window is the Overview's default: on the 3rd of the
// month, month-to-date shows almost nothing and reads as though the work
// stopped, when in fact the previous four weeks were busy. See D33.
export const LAST_30 = "last30";
export const LAST_90 = "last90";
const ROLLING_DAYS: Record<string, number> = { [LAST_30]: 30, [LAST_90]: 90 };
export function isRolling(period: string) {
  return period in ROLLING_DAYS;
}

// Month-key range as plain UTC calendar boundaries — the same simplification
// dashboard-compute.ts's periodRange() already uses for COLD_EMAIL (dates are
// bucketed into the correct local day at write time via dateKeyInTimezone;
// range math elsewhere in this codebase stays in UTC calendar terms).
function monthRangeUtc(monthKey: string): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export function periodRange(period: string): { start: Date; end: Date } {
  const days = ROLLING_DAYS[period];
  if (days) {
    const end = new Date();
    return { start: new Date(end.getTime() - days * 86_400_000), end };
  }
  return monthRangeUtc(period);
}

const fmtInt = (n: number) => n.toLocaleString("en-US");
const fmtMoney = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;
// Headline figures round to whole dollars (per the approved mock); the
// supporting detail line shows exact cents, since "$37.27 paid to Google"
// is the number Alan can reconcile against the real invoice.
const fmtMoneyExact = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const monthName = (monthKey: string) => formatMonthKey(monthKey).split(" ")[0];

// Google reports Local Services figures a month at a time, so a rolling
// window has nothing daily to slice. We take the whole months the window
// covers — one for 30 days, three for 90 — sum what's summable and average
// the rates, then name the months used in the support line. Pro-rating was
// rejected: it would invent a number Google never published. See D33/D35.
type LsaAgg = {
  months: string[];
  impressions: number;
  spendCents: number;
  chargedLeads: number;
  topRatePct: number;
  absTopRatePct: number;
  updatedAt: Date;
};

async function lsaForPeriod(clientId: string, period: string): Promise<LsaAgg | null> {
  const take = period === LAST_90 ? 3 : 1;
  const rows = isRolling(period)
    ? (await prisma.lsaMonthlyStat.findMany({ where: { clientId }, orderBy: { month: "desc" }, take })).reverse()
    : await prisma.lsaMonthlyStat.findMany({ where: { clientId, month: period } });
  if (rows.length === 0) return null;

  const weight = rows.reduce((sum, r) => sum + r.impressions, 0) || rows.length;
  const wavg = (pick: (r: (typeof rows)[number]) => number) =>
    rows.reduce((sum, r) => sum + pick(r) * (r.impressions || 1), 0) / weight;

  return {
    months: rows.map((r) => r.month),
    impressions: rows.reduce((sum, r) => sum + r.impressions, 0),
    spendCents: rows.reduce((sum, r) => sum + r.spendCents, 0),
    chargedLeads: rows.reduce((sum, r) => sum + r.chargedLeads, 0),
    // Rates are averaged by how often the ad was actually shown, not by
    // month — a month with 30 impressions shouldn't weigh the same as one
    // with 300.
    topRatePct: wavg((r) => r.topRatePct),
    absTopRatePct: wavg((r) => r.absTopRatePct),
    updatedAt: rows.reduce((a, r) => (r.updatedAt > a ? r.updatedAt : a), rows[0].updatedAt),
  };
}

// "July", or "May to July" when a window spans several.
function monthsLabel(months: string[]): string {
  if (months.length === 1) return monthName(months[0]);
  return `${monthName(months[0])} to ${monthName(months[months.length - 1])}`;
}

// A lead counts unless someone said otherwise. Every contact is already
// filtered hard upstream (robocalls and spam forms never become leads at
// all), so "worthwhile" is the default and marking one a bad fit is the
// exception — qualified === false. Deleted leads never count. See D34.
// NOT: { qualified: false } would be wrong: in SQL, NOT (NULL = false) is
// NULL, so every unreviewed lead — which is nearly all of them — would be
// silently excluded. Spell the two accepted states out instead.
const COUNTS: Prisma.ServiceLeadWhereInput = {
  deletedAt: null,
  OR: [{ qualified: null }, { qualified: true }],
};

const RESOLVERS: Record<string, Resolver> = {
  // Every ServiceLead row is, by construction, a real lead — spam/robocall
  // calls and form submissions never become ServiceLead rows (they're
  // filtered upstream in the Gmail/CallRail sync, Phase 3).
  "leads.real": async ({ clientId }, period) => {
    if (!period) throw new Error('"leads.real" requires a :YYYY-MM period');
    const { start, end } = periodRange(period);
    const count = await prisma.serviceLead.count({
      where: { clientId, ...COUNTS, receivedAt: { gte: start, lt: end } },
    });
    return { display: fmtInt(count), source: "Leads board", asOf: null };
  },

  "leads.split": async ({ clientId }, period) => {
    if (!period) throw new Error('"leads.split" requires a :YYYY-MM period');
    const { start, end } = periodRange(period);
    const leads = await prisma.serviceLead.findMany({
      where: { clientId, ...COUNTS, receivedAt: { gte: start, lt: end } },
      select: { source: true },
    });
    if (leads.length === 0) return { display: "", source: "Leads board", asOf: null };
    const paid = leads.filter((l) => l.source === "LSA").length;
    const organic = leads.length - paid;
    const parts = [
      organic > 0 ? `${organic} found you free on Google` : null,
      paid > 0 ? `${paid} from Google Ads` : null,
    ].filter(Boolean);
    return { display: parts.join(" · "), source: "Leads board", asOf: null };
  },

  // No public LSA API — this is Alan's manual monthly entry (LsaMonthlyStat),
  // and Google only reports it a month at a time. So there is no such thing
  // as a true rolling-30-day ad figure: for "last30" we show the most recent
  // month Alan has entered and name that month in the support line, rather
  // than pro-rating a number Google never published.
  "lsa.cpl": async ({ clientId }, period) => {
    if (!period) throw new Error('"lsa.cpl" requires a period');
    const agg = await lsaForPeriod(clientId, period);
    if (!agg || agg.chargedLeads === 0) {
      return { display: "—", source: "Google Ads (manual entry)", asOf: agg?.updatedAt ?? null };
    }
    return {
      display: fmtMoney(agg.spendCents / agg.chargedLeads),
      source: "Google Ads (manual entry)",
      asOf: agg.updatedAt,
    };
  },

  "lsa.cpl.support": async ({ clientId }, period) => {
    if (!period) throw new Error('"lsa.cpl.support" requires a period');
    const agg = await lsaForPeriod(clientId, period);
    // A bare "—" with nothing under it reads as "broken" to a
    // non-technical reader. Say plainly why it's empty instead.
    if (!agg) {
      return { display: "The ad figures haven't been added yet", source: "Google Ads (manual entry)", asOf: null };
    }
    if (agg.chargedLeads === 0) {
      return {
        display: `No charged leads from Google ads in ${monthsLabel(agg.months)}`,
        source: "Google Ads (manual entry)",
        asOf: agg.updatedAt,
      };
    }
    const leadWord = agg.chargedLeads === 1 ? "lead" : "leads";
    return {
      display: `${fmtMoneyExact(agg.spendCents)} paid to Google in ${monthsLabel(agg.months)} for ${agg.chargedLeads} ${leadWord}`,
      source: "Google Ads (manual entry)",
      asOf: agg.updatedAt,
    };
  },

  // ---- The Numbers page ----
  "lsa.impressions": async ({ clientId }, period) => {
    if (!period) throw new Error('"lsa.impressions" requires a period');
    const agg = await lsaForPeriod(clientId, period);
    if (!agg) return { display: "—", source: "Google Ads (manual entry)", asOf: null };
    return { display: fmtInt(agg.impressions), source: "Google Ads (manual entry)", asOf: agg.updatedAt };
  },

  // "May 202 · June 336 · July 300" — the trend line under a headline number.
  "lsa.impressions.trend": async ({ clientId }) => {
    const stats = await prisma.lsaMonthlyStat.findMany({ where: { clientId }, orderBy: { month: "asc" }, take: 6 });
    if (stats.length === 0) return { display: "", source: "Google Ads (manual entry)", asOf: null };
    return {
      display: stats.map((s) => `${monthName(s.month)} ${fmtInt(s.impressions)}`).join(" · "),
      source: "Google Ads (manual entry)",
      asOf: stats[stats.length - 1].updatedAt,
    };
  },

  "lsa.topRate": async ({ clientId }, period) => {
    if (!period) throw new Error('"lsa.topRate" requires a period');
    const agg = await lsaForPeriod(clientId, period);
    if (!agg) return { display: "—", source: "Google Ads (manual entry)", asOf: null };
    return { display: `${Math.round(agg.absTopRatePct)}%`, source: "Google Ads (manual entry)", asOf: agg.updatedAt };
  },

  "lsa.topRate.support": async ({ clientId }, period) => {
    if (!period) throw new Error('"lsa.topRate.support" requires a period');
    const agg = await lsaForPeriod(clientId, period);
    if (!agg) return { display: "", source: "Google Ads (manual entry)", asOf: null };
    // Compare against the month before the earliest one in this window.
    const stats = await prisma.lsaMonthlyStat.findMany({ where: { clientId }, orderBy: { month: "asc" } });
    const idx = stats.findIndex((s) => s.month === agg.months[0]);
    if (idx <= 0) return { display: `Measured across ${monthsLabel(agg.months)}`, source: "Google Ads (manual entry)", asOf: agg.updatedAt };
    const prev = stats[idx - 1];
    return {
      display: `Was ${Math.round(prev.absTopRatePct)}% in ${monthName(prev.month)}`,
      source: "Google Ads (manual entry)",
      asOf: agg.updatedAt,
    };
  },

  "lsa.spend": async ({ clientId }, period) => {
    if (!period) throw new Error('"lsa.spend" requires a period');
    const agg = await lsaForPeriod(clientId, period);
    if (!agg) return { display: "—", source: "Google Ads (manual entry)", asOf: null };
    return { display: fmtMoney(agg.spendCents), source: "Google Ads (manual entry)", asOf: agg.updatedAt };
  },

  "lsa.chargedLeads": async ({ clientId }, period) => {
    if (!period) throw new Error('"lsa.chargedLeads" requires a period');
    const agg = await lsaForPeriod(clientId, period);
    if (!agg) return { display: "—", source: "Google Ads (manual entry)", asOf: null };
    return { display: fmtInt(agg.chargedLeads), source: "Google Ads (manual entry)", asOf: agg.updatedAt };
  },

  "lsa.chargedLeads.trend": async ({ clientId }) => {
    const stats = await prisma.lsaMonthlyStat.findMany({ where: { clientId }, orderBy: { month: "asc" }, take: 6 });
    if (stats.length === 0) return { display: "", source: "Google Ads (manual entry)", asOf: null };
    return {
      display: stats.map((s) => `${monthName(s.month)} ${s.chargedLeads}`).join(" · "),
      source: "Google Ads (manual entry)",
      asOf: null,
    };
  },

  // Leads that cost nothing per lead — everything except paid LSA.
  "leads.organic": async ({ clientId }, period) => {
    if (!period) throw new Error('"leads.organic" requires a :YYYY-MM period');
    const { start, end } = periodRange(period);
    const count = await prisma.serviceLead.count({
      where: { clientId, ...COUNTS, receivedAt: { gte: start, lt: end }, source: { not: "LSA" } },
    });
    return { display: fmtInt(count), source: "Leads board", asOf: null };
  },

  "leads.organic.support": async ({ clientId }, period) => {
    if (!period) throw new Error('"leads.organic.support" requires a :YYYY-MM period');
    const { start, end } = periodRange(period);
    const leads = await prisma.serviceLead.findMany({
      where: { clientId, ...COUNTS, receivedAt: { gte: start, lt: end }, source: { not: "LSA" } },
      select: { source: true },
    });
    if (leads.length === 0) return { display: "", source: "Leads board", asOf: null };
    const label: Record<string, string> = {
      GBP_CALL: "Google Maps call",
      WEBSITE_FORM: "website form",
      REFERRAL: "referral",
      OTHER: "other",
    };
    const counts = new Map<string, number>();
    for (const l of leads) counts.set(l.source, (counts.get(l.source) ?? 0) + 1);
    return {
      display: [...counts.entries()]
        .map(([s, n]) => `${n} ${label[s] ?? s.toLowerCase()}${n === 1 ? "" : "s"}`)
        .join(" · "),
      source: "Leads board",
      asOf: null,
    };
  },

  // A flat "0" here reads as "you won nothing", when the truth is nobody has
  // marked an outcome on the Leads board yet. Until the first one is marked,
  // say we don't know — a zero we can't stand behind is worse than a blank.
  // See D43.
  "jobs.won": async ({ clientId }, period) => {
    if (!period) throw new Error('"jobs.won" requires a :YYYY-MM period');
    const { start, end } = periodRange(period);
    const count = await prisma.serviceLead.count({
      where: { clientId, ...COUNTS, stage: "JOB_WON", stageChangedAt: { gte: start, lt: end } },
    });
    if (count > 0) return { display: fmtInt(count), source: "Leads board", asOf: null };

    const everMarked = await prisma.serviceLead.count({ where: { clientId, stage: "JOB_WON" } });
    return {
      display: everMarked === 0 ? "Not tracked yet" : "0",
      source: "Leads board",
      asOf: null,
    };
  },

  "jobs.won.support": async ({ clientId }, period) => {
    if (!period) throw new Error('"jobs.won.support" requires a period');
    const everMarked = await prisma.serviceLead.count({ where: { clientId, stage: "JOB_WON" } });
    if (everMarked === 0) {
      return {
        display: "We only know this once a lead is moved to Job Won on the Leads page",
        source: "Leads board",
        asOf: null,
      };
    }
    const { start, end } = periodRange(period);
    const won = await prisma.serviceLead.findMany({
      where: { clientId, ...COUNTS, stage: "JOB_WON", stageChangedAt: { gte: start, lt: end } },
      select: { jobValue: true },
    });
    if (won.length === 0) return { display: "None marked won in this window", source: "Leads board", asOf: null };
    const total = won.reduce((sum, l) => sum + (l.jobValue ?? 0), 0);
    return { display: `$${total.toLocaleString("en-US")} in accepted work`, source: "Leads board", asOf: null };
  },

  "jobs.wonValue": async ({ clientId }, period) => {
    if (!period) throw new Error('"jobs.wonValue" requires a :YYYY-MM period');
    const { start, end } = periodRange(period);
    const won = await prisma.serviceLead.findMany({
      where: { clientId, ...COUNTS, stage: "JOB_WON", stageChangedAt: { gte: start, lt: end } },
      select: { jobValue: true },
    });
    if (won.length === 0) return { display: "", source: "Leads board", asOf: null };
    const total = won.reduce((sum, l) => sum + (l.jobValue ?? 0), 0);
    return { display: `$${total.toLocaleString("en-US")} in accepted work`, source: "Leads board", asOf: null };
  },

  "gsc.pagesShowing": async ({ clientId }) => {
    const pages = await prisma.sitePage.findMany({ where: { clientId }, select: { indexed: true, indexedAt: true } });
    if (pages.length === 0) return { display: "—", source: "Search Console / manual entry", asOf: null };
    const indexed = pages.filter((p) => p.indexed).length;
    const asOf = pages.reduce<Date | null>(
      (latest, p) => (p.indexedAt && (!latest || p.indexedAt > latest) ? p.indexedAt : latest),
      null,
    );
    return { display: `${indexed} of ${pages.length}`, source: "Search Console / manual entry", asOf };
  },

  "gsc.pagesShowing.support": async ({ clientId }) => {
    const pages = await prisma.sitePage.findMany({ where: { clientId }, select: { indexed: true } });
    if (pages.length === 0) {
      return { display: "Your town pages will be listed here as they go live", source: "Search Console / manual entry", asOf: null };
    }
    const waiting = pages.filter((p) => !p.indexed).length;
    const display = waiting > 0 ? `${waiting} still processing` : "All pages showing";
    return { display, source: "Search Console / manual entry", asOf: null };
  },

  // Period-aware. Without this the recap showed today's count for May, June
  // and July alike — the same 34 three times, which is plainly wrong to
  // anyone who knows reviews came in over that stretch. We only started
  // snapshotting on 2 Aug 2026, so anything earlier is genuinely unknowable:
  // return blank and let the page drop the cell rather than assert a number
  // we never measured. See D46.
  "reviews.count": async ({ clientId }, period) => {
    if (!period || isRolling(period)) {
      const latest = await prisma.reviewSnapshot.findFirst({ where: { clientId }, orderBy: { date: "desc" } });
      if (!latest) return { display: "—", source: "Google Business Profile", asOf: null };
      return { display: fmtInt(latest.count), source: "Google Business Profile", asOf: latest.date };
    }
    const { end } = periodRange(period);
    const asOfMonth = await prisma.reviewSnapshot.findFirst({
      where: { clientId, date: { lt: end } },
      orderBy: { date: "desc" },
    });
    if (!asOfMonth) return { display: "", source: "Google Business Profile", asOf: null };
    return { display: fmtInt(asOfMonth.count), source: "Google Business Profile", asOf: asOfMonth.date };
  },

  "reviews.support": async ({ clientId, tz }) => {
    const latest = await prisma.reviewSnapshot.findFirst({ where: { clientId }, orderBy: { date: "desc" } });
    if (!latest) {
      return { display: "We're still hooking up your Google reviews", source: "Google Business Profile", asOf: null };
    }
    const monthStart = monthRangeUtc(monthKeyInTimezone(new Date(), tz)).start;
    const beforeThisMonth = await prisma.reviewSnapshot.findFirst({
      where: { clientId, date: { lt: monthStart } },
      orderBy: { date: "desc" },
    });
    const ratingLabel = latest.rating === 5 ? "Perfect 5.0 rating" : `${latest.rating.toFixed(1)} rating`;
    // Only claim a "new this month" figure when there's an earlier snapshot
    // to subtract from. Without one, every existing review looks brand new
    // — the first sync would have announced "34 new this month".
    if (!beforeThisMonth) {
      return { display: ratingLabel, source: "Google Business Profile", asOf: latest.date };
    }
    const newThisMonth = Math.max(0, latest.count - beforeThisMonth.count);
    const newLabel = newThisMonth > 0 ? ` · ${newThisMonth} new this month` : "";
    return { display: `${ratingLabel}${newLabel}`, source: "Google Business Profile", asOf: latest.date };
  },

  // Robocalls/spam/wrong-area calls plus rejected website-form spam — logged
  // but never shown to the client as leads (handoff §3.2B/§3.3: "spam is
  // logged, never deleted").
  "junk.blocked": async ({ clientId }, period) => {
    if (!period) throw new Error('"junk.blocked" requires a :YYYY-MM period');
    const { start, end } = periodRange(period);
    const [junkCalls, junkForms] = await Promise.all([
      prisma.callRecord.count({
        where: { clientId, occurredAt: { gte: start, lt: end }, classification: { in: ["ROBOCALL", "SPAM", "WRONG_AREA"] } },
      }),
      prisma.formSubmission.count({
        where: { clientId, receivedAt: { gte: start, lt: end }, spamVerdict: false },
      }),
    ]);
    return { display: fmtInt(junkCalls + junkForms), source: "CallRail / website form filter", asOf: null };
  },
};

export async function resolveMetrics(clientId: string, tz: string, keys: string[]): Promise<Map<string, ResolvedMetric>> {
  const ctx: ResolverCtx = { clientId, tz };

  const overrides = keys.length
    ? await prisma.metricOverride.findMany({ where: { clientId, scopeKey: { in: keys } } })
    : [];
  const oMap = new Map(overrides.map((o) => [o.scopeKey, o]));

  const entries = await Promise.all(
    keys.map(async (key) => {
      const [prefix, period] = splitKey(key);
      const resolver = RESOLVERS[prefix];
      if (!resolver) throw new Error(`No resolver registered for metric key prefix "${prefix}" (from "${key}")`);
      // Always compute live, even when overridden — the override badge and
      // originalValue both depend on knowing the live value too.
      const live = await resolver(ctx, period);
      const override = oMap.get(key);
      const resolved: ResolvedMetric = {
        scopeKey: key,
        display: override?.value ?? live.display,
        liveDisplay: live.display,
        overridden: !!override,
        source: live.source,
        asOf: live.asOf,
      };
      return [key, resolved] as const;
    }),
  );

  return new Map(entries);
}
