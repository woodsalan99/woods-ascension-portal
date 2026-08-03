import { requireClientType } from "@/lib/dashboard-scope";
import { prisma } from "@/lib/prisma";
import { getContent } from "@/lib/content";
import { resolveMetrics } from "@/lib/ls-metrics";
import { formatMonthKey } from "@/lib/timezone";
import { periodOptions, periodRangeLabel, resolvePeriod } from "@/lib/ls-periods";
import { PeriodSwitch } from "@/components/ls/PeriodSwitch";
import { EditProvider } from "@/components/ls/EditProvider";
import { E } from "@/components/ls/Editable";
import { Num } from "@/components/ls/Num";
import { NumberCard } from "@/components/ls/NumberCard";
import type { ContentKey } from "@/content/local-services";

// Improvement bullets are stored as one pipe-separated string per card so
// Alan edits them as a single field rather than juggling one key per bullet.
function bullets(text: string) {
  return (
    <ul>
      {text.split("|").map((b, i) => (
        <li key={i}>{b.trim()}</li>
      ))}
    </ul>
  );
}

export default async function NumbersPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const scope = await requireClientType("LOCAL_SERVICES");
  const { p } = await searchParams;
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: scope.clientId },
    select: { id: true, timezone: true },
  });
  const content = await getContent(client.id);
  const c = (k: ContentKey) => content.text(k);

  // Every period-scoped card on this page follows the chosen window. The
  // month-by-month chart below deliberately does not — it's the "since we
  // started" view, and a window would defeat the point of it.
  const chosen = resolvePeriod(p, client.timezone);
  const month = chosen.period;

  const keys = [
    `lsa.chargedLeads:${month}`,
    "lsa.chargedLeads.trend",
    `lsa.cpl:${month}`,
    `lsa.cpl.support:${month}`,
    `lsa.impressions:${month}`,
    "lsa.impressions.trend",
    `lsa.topRate:${month}`,
    `lsa.topRate.support:${month}`,
    `lsa.spend:${month}`,
    `jobs.won.support:${month}`,
    `leads.real:${month}`, `leads.split:${month}`,
    `leads.organic:${month}`, `leads.organic.support:${month}`,
    `jobs.won:${month}`, `jobs.wonValue:${month}`,
    "reviews.count", "reviews.support",
  ];
  const metrics = await resolveMetrics(client.id, client.timezone, keys);
  const m = (k: string) => metrics.get(k)!;

  // A card that shows "—" must not also claim "Excellent". Switching to a
  // month with no figures entered used to leave the old badge sitting there
  // asserting a judgement nobody had made. See D37.
  const hasValue = (k: string) => {
    const d = m(k).display;
    return d !== "" && d !== "—";
  };
  const status = (valueKey: string, contentKey: ContentKey, label: string) =>
    hasValue(valueKey) ? <E k={contentKey} v={c(contentKey)} label={label} /> : undefined;

  // Month-by-month chart: ad impressions (bars) against real customers.
  const lsaMonths = await prisma.lsaMonthlyStat.findMany({
    where: { clientId: client.id },
    orderBy: { month: "asc" },
    take: 8,
  });
  // Per month: total leads, and the paid/free split beneath it. The whole
  // argument of this page is that the free half is the one that compounds,
  // so the chart has to show both, not just a total. See D43.
  const leadsByMonth = await Promise.all(
    lsaMonths.map(async (s) => {
      const [y, mo] = s.month.split("-").map(Number);
      const rows = await prisma.serviceLead.findMany({
        where: {
          clientId: client.id,
          // Same rule as every other lead count: deleted and bad-fit leads
          // don't count, or deleting one would leave it in this chart.
          deletedAt: null,
          OR: [{ qualified: null }, { qualified: true }],
          receivedAt: { gte: new Date(Date.UTC(y, mo - 1, 1)), lt: new Date(Date.UTC(y, mo, 1)) },
        },
        select: { source: true },
      });
      const paid = rows.filter((r) => r.source === "LSA").length;
      return { total: rows.length, paid, free: rows.length - paid };
    }),
  );
  const maxImpressions = Math.max(1, ...lsaMonths.map((s) => s.impressions));

  return (
    <EditProvider clientId={client.id} canEdit={scope.isPreview}>
      <div className="wa-page-head">
        <div>
          <div className="wa-eyebrow">
            <E k="numbers.eyebrow" v={c("numbers.eyebrow")} label="Numbers eyebrow" />
          </div>
          <h1 className="wa-page-title">
            <E k="numbers.title" v={c("numbers.title")} label="Numbers title" />
          </h1>
          <div className="wa-page-sub">
            <E k="numbers.sub" v={c("numbers.sub")} label="Numbers subtitle" multiline />
          </div>
        </div>
        <PeriodSwitch
          basePath="/numbers"
          options={periodOptions(client.timezone)}
          current={chosen.value}
          rangeLabel={periodRangeLabel(month, client.timezone)}
        />
      </div>

      {/* Leads lead. The three gold cards are the lead-source split — total,
          paid, free — because that trio is the whole point of the page and
          everything else is supporting detail. See D43. */}
      <div className="wa-section-head" style={{ marginTop: 0 }}>
        <h2 className="wa-h2">
          <E k="numbers.customers.title" v={c("numbers.customers.title")} label="Leads section title" />
        </h2>
        <span className="wa-page-sub">
          <E k="numbers.customers.sub" v={c("numbers.customers.sub")} label="Leads section subtitle" />
        </span>
      </div>
      <div className="wa-number-grid">
        <NumberCard
          gold
          label={<E k="numbers.leads.label" v={c("numbers.leads.label")} label="Leads label" />}
          value={<Num m={m(`leads.real:${month}`)} clientId={client.id} label="Real leads this period" />}
          support={<Num m={m(`leads.split:${month}`)} clientId={client.id} label="Free vs paid split" />}
          plain={<E k="numbers.leads.plain" v={c("numbers.leads.plain")} label="Leads explanation" multiline />}
          status={status(`leads.real:${month}`, "numbers.leads.status", "Leads status")}
          healthyRange={<E k="numbers.leads.healthy" v={c("numbers.leads.healthy")} label="Leads healthy range" multiline />}
          improvements={bullets(c("numbers.leads.improve"))}
        />
        <NumberCard
          gold
          label={<E k="numbers.adLeads.label" v={c("numbers.adLeads.label")} label="Ad leads label" />}
          value={<Num m={m(`lsa.chargedLeads:${month}`)} clientId={client.id} label="Charged ad leads" />}
          plain={<E k="numbers.adLeads.plain" v={c("numbers.adLeads.plain")} label="Ad leads explanation" multiline />}
          status={status(`lsa.chargedLeads:${month}`, "numbers.adLeads.status", "Ad leads status")}
          healthyRange={<E k="numbers.adLeads.healthy" v={c("numbers.adLeads.healthy")} label="Ad leads healthy range" multiline />}
          improvements={bullets(c("numbers.adLeads.improve"))}
        />
        <NumberCard
          gold
          label={<E k="numbers.organic.label" v={c("numbers.organic.label")} label="Organic leads label" />}
          value={<Num m={m(`leads.organic:${month}`)} clientId={client.id} label="Free leads" />}
          support={<Num m={m(`leads.organic.support:${month}`)} clientId={client.id} label="Free leads breakdown" />}
          plain={<E k="numbers.organic.plain" v={c("numbers.organic.plain")} label="Organic explanation" multiline />}
          status={status(`leads.organic:${month}`, "numbers.organic.status", "Free leads status")}
          healthyRange={<E k="numbers.organic.healthy" v={c("numbers.organic.healthy")} label="Organic healthy range" multiline />}
          improvements={bullets(c("numbers.organic.improve"))}
        />
      </div>

      {/* Ads live on both pages by design. Here they answer "what did the
          money do"; on Where You Rank they answer "where do people find us".
          Same resolvers, so the two can never disagree. See D45. */}
      <div className="wa-section-head">
        <h2 className="wa-h2">
          <E k="numbers.ads.title" v={c("numbers.ads.title")} label="Ads section title" />
        </h2>
        <span className="wa-page-sub">
          <E k="numbers.ads.sub" v={c("numbers.ads.sub")} label="Ads section subtitle" />
        </span>
      </div>
      <div className="wa-number-grid">
        <NumberCard
          label={<E k="numbers.cpl.label" v={c("numbers.cpl.label")} label="Cost per lead label" />}
          value={<Num m={m(`lsa.cpl:${month}`)} clientId={client.id} label="Cost per ad lead" />}
          support={<Num m={m(`lsa.cpl.support:${month}`)} clientId={client.id} label="Cost per lead detail" />}
          plain={<E k="numbers.cpl.plain" v={c("numbers.cpl.plain")} label="Cost per lead explanation" multiline />}
          status={status(`lsa.cpl:${month}`, "numbers.cpl.status", "Cost per lead status")}
          healthyRange={<E k="numbers.cpl.healthy" v={c("numbers.cpl.healthy")} label="Cost per lead healthy range" multiline />}
          improvements={bullets(c("numbers.cpl.improve"))}
        />
        <NumberCard
          label={<E k="numbers.impressions.label" v={c("numbers.impressions.label")} label="Impressions label" />}
          value={<Num m={m(`lsa.impressions:${month}`)} clientId={client.id} label="Ad impressions" />}
          support={<Num m={m("lsa.impressions.trend")} clientId={client.id} label="Impressions trend" />}
          plain={<E k="numbers.impressions.plain" v={c("numbers.impressions.plain")} label="Impressions explanation" multiline />}
          status={status(`lsa.impressions:${month}`, "numbers.impressions.status", "Impressions status")}
          healthyRange={<E k="numbers.impressions.healthy" v={c("numbers.impressions.healthy")} label="Impressions healthy range" multiline />}
          improvements={bullets(c("numbers.impressions.improve"))}
        />
        <NumberCard
          label={<E k="numbers.topRate.label" v={c("numbers.topRate.label")} label="Top rate label" />}
          value={<Num m={m(`lsa.topRate:${month}`)} clientId={client.id} label="Shown-first rate" />}
          support={<Num m={m(`lsa.topRate.support:${month}`)} clientId={client.id} label="Shown-first previous month" />}
          plain={<E k="numbers.topRate.plain" v={c("numbers.topRate.plain")} label="Top rate explanation" multiline />}
          status={status(`lsa.topRate:${month}`, "numbers.topRate.status", "Top rate status")}
          healthyRange={<E k="numbers.topRate.healthy" v={c("numbers.topRate.healthy")} label="Top rate healthy range" multiline />}
          improvements={bullets(c("numbers.topRate.improve"))}
        />
        <NumberCard
          label={<E k="numbers.spend.label" v={c("numbers.spend.label")} label="Spend label" />}
          value={<Num m={m(`lsa.spend:${month}`)} clientId={client.id} label="Ad spend" />}
          plain={<E k="numbers.spend.plain" v={c("numbers.spend.plain")} label="Spend explanation" multiline />}
          status={status(`lsa.spend:${month}`, "numbers.spend.status", "Spend status")}
          statusTone="watch"
          healthyRange={<E k="numbers.spend.healthy" v={c("numbers.spend.healthy")} label="Spend healthy range" multiline />}
          improvements={bullets(c("numbers.spend.improve"))}
        />
      </div>

      <div className="wa-section-head">
        <h2 className="wa-h2">
          <E k="numbers.outcomes.title" v={c("numbers.outcomes.title")} label="Outcomes section title" />
        </h2>
        <span className="wa-page-sub">
          <E k="numbers.outcomes.sub" v={c("numbers.outcomes.sub")} label="Outcomes section subtitle" />
        </span>
      </div>
      <div className="wa-number-grid">
        <NumberCard
          label={<E k="numbers.jobs.label" v={c("numbers.jobs.label")} label="Jobs won label" />}
          value={<Num m={m(`jobs.won:${month}`)} clientId={client.id} label="Jobs won" />}
          support={<Num m={m(`jobs.won.support:${month}`)} clientId={client.id} label="Jobs won detail" />}
          plain={<E k="numbers.jobs.plain" v={c("numbers.jobs.plain")} label="Jobs explanation" multiline />}
          status={status(`jobs.won:${month}`, "numbers.jobs.status", "Jobs status")}
          healthyRange={<E k="numbers.jobs.healthy" v={c("numbers.jobs.healthy")} label="Jobs healthy range" multiline />}
          improvements={bullets(c("numbers.jobs.improve"))}
        />
        <NumberCard
          label={<E k="numbers.reviews.label" v={c("numbers.reviews.label")} label="Reviews label" />}
          value={<Num m={m("reviews.count")} clientId={client.id} label="Google review count" />}
          support={<Num m={m("reviews.support")} clientId={client.id} label="Reviews detail" />}
          plain={<E k="numbers.reviews.plain" v={c("numbers.reviews.plain")} label="Reviews explanation" multiline />}
          healthyRange={<E k="numbers.reviews.healthy" v={c("numbers.reviews.healthy")} label="Reviews healthy range" multiline />}
          improvements={bullets(c("numbers.reviews.improve"))}
        />
      </div>

      {lsaMonths.length > 0 && (
        <div className="wa-card">
          <div className="wa-section-head">
            <div>
              <div className="wa-eyebrow">
                <E k="numbers.chart.label" v={c("numbers.chart.label")} label="Chart label" />
              </div>
              <h2 className="wa-h2">
                <E k="numbers.chart.title" v={c("numbers.chart.title")} label="Chart title" />
              </h2>
            </div>
          </div>
          <div className="wa-bars">
            {lsaMonths.map((s) => (
              <div key={s.month} className="wa-bar-group">
                <div className="wa-bar-stack">
                  <div className="wa-bar" style={{ height: `${(s.impressions / maxImpressions) * 100}%` }}>
                    <span className="wa-bar-val">{s.impressions}</span>
                  </div>
                </div>
                <span className="wa-bar-label">{formatMonthKey(s.month).split(" ")[0]}</span>
              </div>
            ))}
          </div>
          <div className="wa-bar-marks">
            {leadsByMonth.map((n, i) => (
              <div key={i} className="wa-bar-mark">
                <b>
                  {n.total} lead{n.total === 1 ? "" : "s"}
                </b>
                {n.total > 0 && (
                  <span className="wa-bar-split">
                    {n.free > 0 && <span className="free">{n.free} free</span>}
                    {n.free > 0 && n.paid > 0 && " · "}
                    {n.paid > 0 && <span className="paid">{n.paid} paid</span>}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="wa-bar-legend">
            <span>
              <i className="bar" /> Times your ad was seen
            </span>
            <span>
              <i className="free" /> Leads that cost you nothing
            </span>
            <span>
              <i className="paid" /> Leads from Google Ads
            </span>
          </div>
          <p className="wa-page-sub" style={{ marginTop: 13 }}>
            <E k="numbers.chart.note" v={c("numbers.chart.note")} label="Chart note" multiline />
          </p>
        </div>
      )}
    </EditProvider>
  );
}
