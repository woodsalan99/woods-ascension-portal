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

const fmtInt = (n: number) => n.toLocaleString("en-US");
const fmtMoney = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

const RESOLVERS: Record<string, Resolver> = {
  // Every ServiceLead row is, by construction, a real lead — spam/robocall
  // calls and form submissions never become ServiceLead rows (they're
  // filtered upstream in the Gmail/CallRail sync, Phase 3).
  "leads.real": async ({ clientId }, period) => {
    if (!period) throw new Error('"leads.real" requires a :YYYY-MM period');
    const { start, end } = monthRangeUtc(period);
    const count = await prisma.serviceLead.count({
      where: { clientId, receivedAt: { gte: start, lt: end } },
    });
    return { display: fmtInt(count), source: "Leads board", asOf: null };
  },

  "leads.split": async ({ clientId }, period) => {
    if (!period) throw new Error('"leads.split" requires a :YYYY-MM period');
    const { start, end } = monthRangeUtc(period);
    const leads = await prisma.serviceLead.findMany({
      where: { clientId, receivedAt: { gte: start, lt: end } },
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

  // No public LSA API — this is Alan's manual monthly entry (LsaMonthlyStat).
  "lsa.cpl": async ({ clientId }, period) => {
    if (!period) throw new Error('"lsa.cpl" requires a :YYYY-MM period');
    const stat = await prisma.lsaMonthlyStat.findUnique({ where: { clientId_month: { clientId, month: period } } });
    if (!stat || stat.chargedLeads === 0) {
      return { display: "—", source: "Google Ads (manual entry)", asOf: stat?.updatedAt ?? null };
    }
    return {
      display: fmtMoney(stat.spendCents / stat.chargedLeads),
      source: "Google Ads (manual entry)",
      asOf: stat.updatedAt,
    };
  },

  "lsa.cpl.support": async ({ clientId }, period) => {
    if (!period) throw new Error('"lsa.cpl.support" requires a :YYYY-MM period');
    const stat = await prisma.lsaMonthlyStat.findUnique({ where: { clientId_month: { clientId, month: period } } });
    if (!stat || stat.chargedLeads === 0) return { display: "", source: "Google Ads (manual entry)", asOf: null };
    const leadWord = stat.chargedLeads === 1 ? "lead" : "leads";
    return {
      display: `${fmtMoney(stat.spendCents)} paid to Google in ${formatMonthKey(period)} for ${stat.chargedLeads} ${leadWord}`,
      source: "Google Ads (manual entry)",
      asOf: stat.updatedAt,
    };
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
    if (pages.length === 0) return { display: "", source: "Search Console / manual entry", asOf: null };
    const waiting = pages.filter((p) => !p.indexed).length;
    const display = waiting > 0 ? `${waiting} still processing` : "All pages showing";
    return { display, source: "Search Console / manual entry", asOf: null };
  },

  "reviews.count": async ({ clientId }) => {
    const latest = await prisma.reviewSnapshot.findFirst({ where: { clientId }, orderBy: { date: "desc" } });
    if (!latest) return { display: "—", source: "Google Business Profile", asOf: null };
    return { display: fmtInt(latest.count), source: "Google Business Profile", asOf: latest.date };
  },

  "reviews.support": async ({ clientId, tz }) => {
    const latest = await prisma.reviewSnapshot.findFirst({ where: { clientId }, orderBy: { date: "desc" } });
    if (!latest) return { display: "", source: "Google Business Profile", asOf: null };
    const monthStart = monthRangeUtc(monthKeyInTimezone(new Date(), tz)).start;
    const beforeThisMonth = await prisma.reviewSnapshot.findFirst({
      where: { clientId, date: { lt: monthStart } },
      orderBy: { date: "desc" },
    });
    const newThisMonth = Math.max(0, latest.count - (beforeThisMonth?.count ?? 0));
    const ratingLabel = latest.rating === 5 ? "Perfect 5.0 rating" : `${latest.rating.toFixed(1)} rating`;
    const newLabel = newThisMonth > 0 ? ` · ${newThisMonth} new this month` : "";
    return { display: `${ratingLabel}${newLabel}`, source: "Google Business Profile", asOf: latest.date };
  },

  // Robocalls/spam/wrong-area calls plus rejected website-form spam — logged
  // but never shown to the client as leads (handoff §3.2B/§3.3: "spam is
  // logged, never deleted").
  "junk.blocked": async ({ clientId }, period) => {
    if (!period) throw new Error('"junk.blocked" requires a :YYYY-MM period');
    const { start, end } = monthRangeUtc(period);
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
