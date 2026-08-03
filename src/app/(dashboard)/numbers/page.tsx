import { requireClientType } from "@/lib/dashboard-scope";
import { prisma } from "@/lib/prisma";
import { getContent } from "@/lib/content";
import { resolveMetrics } from "@/lib/ls-metrics";
import { monthKeyInTimezone, formatMonthKey } from "@/lib/timezone";
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

export default async function NumbersPage() {
  const scope = await requireClientType("LOCAL_SERVICES");
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: scope.clientId },
    select: { id: true, timezone: true },
  });
  const content = await getContent(client.id);
  const c = (k: ContentKey) => content.text(k);

  const month = monthKeyInTimezone(new Date(), client.timezone);

  const keys = [
    `lsa.chargedLeads:${month}`, `lsa.chargedLeads.trend`,
    `lsa.cpl:${month}`, `lsa.cpl.support:${month}`,
    `lsa.impressions:${month}`, `lsa.impressions.trend`,
    `lsa.topRate:${month}`, `lsa.topRate.support:${month}`,
    `lsa.spend:${month}`,
    `leads.real:${month}`, `leads.split:${month}`,
    `leads.organic:${month}`, `leads.organic.support:${month}`,
    `jobs.won:${month}`, `jobs.wonValue:${month}`,
    "reviews.count", "reviews.support",
  ];
  const metrics = await resolveMetrics(client.id, client.timezone, keys);
  const m = (k: string) => metrics.get(k)!;

  // Month-by-month chart: ad impressions (bars) against real customers.
  const lsaMonths = await prisma.lsaMonthlyStat.findMany({
    where: { clientId: client.id },
    orderBy: { month: "asc" },
    take: 8,
  });
  const leadsByMonth = await Promise.all(
    lsaMonths.map(async (s) => {
      const [y, mo] = s.month.split("-").map(Number);
      return prisma.serviceLead.count({
        where: {
          clientId: client.id,
          receivedAt: { gte: new Date(Date.UTC(y, mo - 1, 1)), lt: new Date(Date.UTC(y, mo, 1)) },
        },
      });
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
        <span className="wa-weekbadge">{formatMonthKey(month)}</span>
      </div>

      <div className="wa-section-head" style={{ marginTop: 0 }}>
        <h2 className="wa-h2">
          <E k="numbers.ads.title" v={c("numbers.ads.title")} label="Ads section title" />
        </h2>
        <span className="wa-page-sub">
          <E k="numbers.ads.sub" v={c("numbers.ads.sub")} label="Ads section subtitle" />
        </span>
      </div>
      <div className="wa-number-grid">
        <NumberCard
          label={<E k="numbers.adLeads.label" v={c("numbers.adLeads.label")} label="Ad leads label" />}
          value={<Num m={m(`lsa.chargedLeads:${month}`)} clientId={client.id} label="Charged ad leads" />}
          support={<Num m={m("lsa.chargedLeads.trend")} clientId={client.id} label="Ad leads trend" />}
          plain={<E k="numbers.adLeads.plain" v={c("numbers.adLeads.plain")} label="Ad leads explanation" multiline />}
          status="Normal"
          healthyRange={<E k="numbers.adLeads.healthy" v={c("numbers.adLeads.healthy")} label="Ad leads healthy range" multiline />}
          improvements={bullets(c("numbers.adLeads.improve"))}
        />
        <NumberCard
          label={<E k="numbers.cpl.label" v={c("numbers.cpl.label")} label="Cost per lead label" />}
          value={<Num m={m(`lsa.cpl:${month}`)} clientId={client.id} label="Cost per ad lead" />}
          support={<Num m={m(`lsa.cpl.support:${month}`)} clientId={client.id} label="Cost per lead detail" />}
          plain={<E k="numbers.cpl.plain" v={c("numbers.cpl.plain")} label="Cost per lead explanation" multiline />}
          status="Excellent"
          healthyRange={<E k="numbers.cpl.healthy" v={c("numbers.cpl.healthy")} label="Cost per lead healthy range" multiline />}
          improvements={bullets(c("numbers.cpl.improve"))}
        />
        <NumberCard
          label={<E k="numbers.impressions.label" v={c("numbers.impressions.label")} label="Impressions label" />}
          value={<Num m={m(`lsa.impressions:${month}`)} clientId={client.id} label="Ad impressions" />}
          support={<Num m={m("lsa.impressions.trend")} clientId={client.id} label="Impressions trend" />}
          plain={<E k="numbers.impressions.plain" v={c("numbers.impressions.plain")} label="Impressions explanation" multiline />}
          status="Normal"
          healthyRange={<E k="numbers.impressions.healthy" v={c("numbers.impressions.healthy")} label="Impressions healthy range" multiline />}
          improvements={bullets(c("numbers.impressions.improve"))}
        />
        <NumberCard
          label={<E k="numbers.topRate.label" v={c("numbers.topRate.label")} label="Top rate label" />}
          value={<Num m={m(`lsa.topRate:${month}`)} clientId={client.id} label="Shown-first rate" />}
          support={<Num m={m(`lsa.topRate.support:${month}`)} clientId={client.id} label="Shown-first previous month" />}
          plain={<E k="numbers.topRate.plain" v={c("numbers.topRate.plain")} label="Top rate explanation" multiline />}
          status="Excellent"
          healthyRange={<E k="numbers.topRate.healthy" v={c("numbers.topRate.healthy")} label="Top rate healthy range" multiline />}
          improvements={bullets(c("numbers.topRate.improve"))}
        />
        <NumberCard
          label={<E k="numbers.spend.label" v={c("numbers.spend.label")} label="Spend label" />}
          value={<Num m={m(`lsa.spend:${month}`)} clientId={client.id} label="Ad spend" />}
          plain={<E k="numbers.spend.plain" v={c("numbers.spend.plain")} label="Spend explanation" multiline />}
          status="Barely used"
          statusTone="watch"
          healthyRange={<E k="numbers.spend.healthy" v={c("numbers.spend.healthy")} label="Spend healthy range" multiline />}
          improvements={bullets(c("numbers.spend.improve"))}
        />
      </div>

      <div className="wa-section-head">
        <h2 className="wa-h2">
          <E k="numbers.customers.title" v={c("numbers.customers.title")} label="Customers section title" />
        </h2>
        <span className="wa-page-sub">
          <E k="numbers.customers.sub" v={c("numbers.customers.sub")} label="Customers section subtitle" />
        </span>
      </div>
      <div className="wa-number-grid">
        <NumberCard
          label={<E k="numbers.leads.label" v={c("numbers.leads.label")} label="Leads label" />}
          value={<Num m={m(`leads.real:${month}`)} clientId={client.id} label="Real customers this month" />}
          support={<Num m={m(`leads.split:${month}`)} clientId={client.id} label="Free vs paid split" />}
          plain={<E k="numbers.leads.plain" v={c("numbers.leads.plain")} label="Leads explanation" multiline />}
          status="Normal"
          healthyRange={<E k="numbers.leads.healthy" v={c("numbers.leads.healthy")} label="Leads healthy range" multiline />}
          improvements={bullets(c("numbers.leads.improve"))}
        />
        <NumberCard
          label={<E k="numbers.organic.label" v={c("numbers.organic.label")} label="Organic leads label" />}
          value={<Num m={m(`leads.organic:${month}`)} clientId={client.id} label="Free leads" />}
          support={<Num m={m(`leads.organic.support:${month}`)} clientId={client.id} label="Free leads breakdown" />}
          plain={<E k="numbers.organic.plain" v={c("numbers.organic.plain")} label="Organic explanation" multiline />}
          status="Growing"
          healthyRange={<E k="numbers.organic.healthy" v={c("numbers.organic.healthy")} label="Organic healthy range" multiline />}
          improvements={bullets(c("numbers.organic.improve"))}
        />
        <NumberCard
          label={<E k="numbers.jobs.label" v={c("numbers.jobs.label")} label="Jobs won label" />}
          value={<Num m={m(`jobs.won:${month}`)} clientId={client.id} label="Jobs won" />}
          support={<Num m={m(`jobs.wonValue:${month}`)} clientId={client.id} label="Value of jobs won" />}
          plain={<E k="numbers.jobs.plain" v={c("numbers.jobs.plain")} label="Jobs explanation" multiline />}
          status="On track"
          healthyRange={<E k="numbers.jobs.healthy" v={c("numbers.jobs.healthy")} label="Jobs healthy range" multiline />}
          improvements={bullets(c("numbers.jobs.improve"))}
        />
        <NumberCard
          label={<E k="numbers.reviews.label" v={c("numbers.reviews.label")} label="Reviews label" />}
          value={<Num m={m("reviews.count")} clientId={client.id} label="Google review count" />}
          support={<Num m={m("reviews.support")} clientId={client.id} label="Reviews detail" />}
          plain={<E k="numbers.reviews.plain" v={c("numbers.reviews.plain")} label="Reviews explanation" multiline />}
          status="Room to grow"
          statusTone="attn"
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
                {n} customer{n === 1 ? "" : "s"}
              </div>
            ))}
          </div>
          <p className="wa-page-sub" style={{ marginTop: 13 }}>
            <E k="numbers.chart.note" v={c("numbers.chart.note")} label="Chart note" multiline />
          </p>
        </div>
      )}
    </EditProvider>
  );
}
