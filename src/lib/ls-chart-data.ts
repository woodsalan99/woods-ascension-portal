import { prisma } from "@/lib/prisma";
import { formatMonthKey, monthKeyInTimezone } from "@/lib/timezone";
import type { ChartSeries } from "@/components/ls/PerformanceChart";

// Every month-by-month series in one place, so the Overview, Where You Rank
// and The Numbers can't quietly disagree about what June looked like.
//
// The current month is always excluded. It's partial by definition, so
// including it makes every chart end on a cliff that reads as a collapse.
// See D48.
const MONTHS_SHOWN = 6;

export type ChartBundle = { months: string[]; series: ChartSeries[] };

const COLORS = {
  visits: "#8FBFA4",
  impressions: "#C9A961",
  adViews: "#C3C0B2",
  leadsTotal: "#101E2E",
  leadsFree: "#1E6B4F",
  leadsPaid: "#A87E3F",
};

export async function buildChartData(clientId: string, timezone: string): Promise<ChartBundle> {
  const current = monthKeyInTimezone(new Date(), timezone);

  const [gscDaily, lsaMonths, leads] = await Promise.all([
    prisma.gscDailyStat.findMany({ where: { clientId }, orderBy: { date: "asc" } }),
    prisma.lsaMonthlyStat.findMany({ where: { clientId }, orderBy: { month: "asc" } }),
    prisma.serviceLead.findMany({
      where: { clientId, deletedAt: null, OR: [{ qualified: null }, { qualified: true }] },
      select: { source: true, receivedAt: true },
    }),
  ]);

  const gsc = new Map<string, { clicks: number; impressions: number }>();
  for (const d of gscDaily) {
    const key = `${d.date.getUTCFullYear()}-${String(d.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const row = gsc.get(key) ?? { clicks: 0, impressions: 0 };
    row.clicks += d.clicks;
    row.impressions += d.impressions;
    gsc.set(key, row);
  }

  const leadsByMonth = new Map<string, { total: number; free: number; paid: number }>();
  for (const l of leads) {
    const key = `${l.receivedAt.getUTCFullYear()}-${String(l.receivedAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const row = leadsByMonth.get(key) ?? { total: 0, free: 0, paid: 0 };
    row.total += 1;
    if (l.source === "LSA") row.paid += 1;
    else row.free += 1;
    leadsByMonth.set(key, row);
  }

  const lsa = new Map(lsaMonths.map((m) => [m.month, m]));

  // The window is whatever has any data at all, minus the partial month.
  const keys = [...new Set([...gsc.keys(), ...lsa.keys(), ...leadsByMonth.keys()])]
    .filter((k) => k !== current)
    .sort()
    .slice(-MONTHS_SHOWN);

  // null, not 0, where a source wasn't running yet — a line that dives to
  // zero for months we simply weren't measuring is a lie about a collapse.
  const at = <T,>(map: Map<string, T>, k: string) => map.get(k) ?? null;

  return {
    months: keys.map((k) => formatMonthKey(k).split(" ")[0].slice(0, 3)),
    series: [
      {
        key: "visits",
        label: "Visits to your site",
        kind: "bar",
        scale: "people",
        color: COLORS.visits,
        values: keys.map((k) => at(gsc, k)?.clicks ?? null),
      },
      {
        key: "leadsTotal",
        label: "Total leads",
        kind: "line",
        scale: "people",
        color: COLORS.leadsTotal,
        values: keys.map((k) => at(leadsByMonth, k)?.total ?? null),
      },
      {
        key: "leadsFree",
        label: "Leads that cost you nothing",
        kind: "line",
        scale: "people",
        color: COLORS.leadsFree,
        values: keys.map((k) => at(leadsByMonth, k)?.free ?? null),
      },
      {
        key: "leadsPaid",
        label: "Leads from Google Ads",
        kind: "line",
        scale: "people",
        color: COLORS.leadsPaid,
        values: keys.map((k) => at(leadsByMonth, k)?.paid ?? null),
      },
      {
        key: "impressions",
        label: "Times you appeared in search",
        kind: "line",
        scale: "views",
        color: COLORS.impressions,
        values: keys.map((k) => at(gsc, k)?.impressions ?? null),
      },
      {
        key: "adViews",
        label: "Times your ad was seen",
        kind: "line",
        scale: "views",
        color: COLORS.adViews,
        values: keys.map((k) => at(lsa, k)?.impressions ?? null),
      },
    ],
  };
}

// What shows before anyone touches anything. Site visits and total leads —
// the two numbers that answer "is this working". The thousands-scale series
// stay off, because switching them on rescales everything else into a line
// along the bottom, and that should be the client's choice.
export const CHART_DEFAULT_ON = ["visits", "leadsTotal"];
export const CHART_DEFAULT_LEADS = ["leadsTotal", "leadsFree", "leadsPaid"];
export const CHART_DEFAULT_WEBSITE = ["visits", "impressions"];
