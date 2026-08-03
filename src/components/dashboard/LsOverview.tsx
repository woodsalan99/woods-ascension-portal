import { getDashboardScope } from "@/lib/dashboard-scope";
import { prisma } from "@/lib/prisma";
import { getContent } from "@/lib/content";
import { resolveMetrics, LAST_30 } from "@/lib/ls-metrics";
import { periodRangeLabel } from "@/lib/ls-periods";
import { PeriodSwitch } from "@/components/ls/PeriodSwitch";
import { LatestLeads, type LatestLeadVM } from "@/components/ls/LatestLeads";
import { monthKeyInTimezone } from "@/lib/timezone";
import { EditProvider } from "@/components/ls/EditProvider";
import { E, EList } from "@/components/ls/Editable";
import { Num } from "@/components/ls/Num";

// The real LOCAL_SERVICES Overview (Phase 2) — ported from
// canencia_portal_v8.html's Overview section. Every visible string renders
// through the content registry (<E>/<EList>); every number renders through
// a resolver (<Num>), overridable by an admin in preview mode. See
// IMPLEMENTATION_STATE.md §3a/§3c.
//
// Two things intentionally do NOT go through the registry, because they
// belong to a different system that doesn't exist yet (Phase 5's Monthly
// Recap builder): the hero title/sub once a MonthlyWork row exists for the
// month, and the "what we built" work items themselves. Until Phase 5
// ships, no MonthlyWork row exists, so this page shows the registry
// DEFAULT hero copy and an empty-state for the work block — both of which
// ARE registry-editable, since right now they're what's actually visible.
// A work item's own date is what decides whether it falls inside a rolling
// window. Items entered before dates existed have none — treat those as the
// last day of the month they were logged under, so they age out in order
// rather than all at once.
// Canencia's public Google Maps profile — where the reviews the KPI counts
// actually live, so the client can go and look at them.
const GOOGLE_MAPS_URL = "https://share.google/ZbLNa2ZWm0izmx0VN";

type WorkItem = { title: string; detail?: string; date?: string };

function itemDate(item: WorkItem, month: string): Date {
  if (item.date) return new Date(`${item.date}T12:00:00Z`);
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 12));
}

export async function LsOverview({ period }: { period?: string }) {
  const scope = await getDashboardScope();
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: scope.clientId },
    select: { id: true, heroName: true, name: true, timezone: true },
  });

  const content = await getContent(client.id);
  const now = new Date();
  const monthKey = monthKeyInTimezone(now, client.timezone);

  // Rolling 30 days by default. Month-to-date is one tap away, but it is the
  // wrong first impression: on the 2nd of the month it shows a nearly empty
  // page, which reads as "nothing is happening" rather than "the month just
  // started". See D33.
  const isMtd = period === "mtd";
  const window = isMtd ? monthKey : LAST_30;

  const metricKeys = [
    `leads.real:${window}`,
    `leads.split:${window}`,
    `lsa.cpl:${window}`,
    `lsa.cpl.support:${window}`,
    "gsc.pagesShowing",
    "gsc.pagesShowing.support",
    "reviews.count",
    "reviews.support",
  ];
  const metrics = await resolveMetrics(client.id, client.timezone, metricKeys);
  const metric = (k: string) => metrics.get(k)!;

  // The hero copy still belongs to the calendar month it was written for —
  // it's the month-end write-up, not a rolling summary.
  const monthlyWork = await prisma.monthlyWork.findUnique({
    where: { clientId_month: { clientId: client.id, month: monthKey } },
  });

  // In rolling mode the window straddles two calendar months, so work items
  // come from both rows and are filtered by their own date.
  const cutoff = new Date(now.getTime() - 30 * 86_400_000);
  const [curYear, curMonth] = monthKey.split("-").map(Number);
  const prevMonthKey =
    curMonth === 1 ? `${curYear - 1}-12` : `${curYear}-${String(curMonth - 1).padStart(2, "0")}`;
  const workRows = isMtd
    ? monthlyWork
      ? [monthlyWork]
      : []
    : await prisma.monthlyWork.findMany({
        where: { clientId: client.id, month: { in: [monthKey, prevMonthKey] } },
      });

  const workItems = workRows
    .flatMap((row) =>
      ((row.items as WorkItem[] | null) ?? []).map((item) => ({ ...item, at: itemDate(item, row.month) })),
    )
    .filter((item) => (isMtd ? true : item.at >= cutoff))
    .sort((a, b) => b.at.getTime() - a.at.getTime());

  const dateRangeLabel = periodRangeLabel(window, client.timezone, now);

  // Overview offers the two windows that matter here. The Numbers page has
  // the full set — this is a front page, not a report.
  const PERIODS = [
    { value: LAST_30, label: content.text("overview.period.rolling") },
    { value: "mtd", label: content.text("overview.period.mtd") },
  ];

  // Most-recent-first, regardless of stage. "Needs you" only ever showed
  // leads with a next-action date set, which almost none have — so it was
  // usually empty on the busiest page of the portal. See D40.
  const latestRows = await prisma.serviceLead.findMany({
    where: { clientId: client.id, deletedAt: null, OR: [{ qualified: null }, { qualified: true }] },
    orderBy: { receivedAt: "desc" },
    take: 6,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      source: true,
      serviceType: true,
      message: true,
      receivedAt: true,
      // The notes themselves, not a count — the client needs the words to
      // recognise a lead without opening it. See D45.
      notes: { orderBy: { createdAt: "desc" }, take: 5, select: { id: true, body: true, createdAt: true } },
    },
  });

  const SOURCE_LABEL: Record<string, string> = {
    LSA: "Google Ads",
    GBP_CALL: "Google Maps call",
    WEBSITE_FORM: "Website form",
    REFERRAL: "Referral",
    OTHER: "Other",
  };
  const latestLeads: LatestLeadVM[] = latestRows.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    email: l.email,
    sourceLabel: SOURCE_LABEL[l.source] ?? l.source,
    serviceType: l.serviceType,
    message: l.message,
    receivedAt: l.receivedAt,
    notes: l.notes,
  }));

  return (
    <EditProvider clientId={client.id} canEdit={scope.isPreview}>
      <div className="wa-page-head">
        <div>
          {monthlyWork ? (
            <h1 className="wa-page-title">{monthlyWork.heroTitleManual ?? monthlyWork.heroTitleAuto}</h1>
          ) : (
            <h1 className="wa-page-title">
              <E k="overview.hero.titleDefault" v={content.text("overview.hero.titleDefault")} label="Hero title" />
            </h1>
          )}
          {monthlyWork ? (
            <div className="wa-page-sub">{monthlyWork.heroSubManual ?? monthlyWork.heroSubAuto}</div>
          ) : (
            <div className="wa-page-sub">
              <E
                k="overview.hero.subDefault"
                v={content.text("overview.hero.subDefault")}
                label="Hero subtitle"
                multiline
              />
            </div>
          )}
        </div>
        <PeriodSwitch
          basePath="/"
          options={PERIODS}
          current={isMtd ? "mtd" : LAST_30}
          rangeLabel={dateRangeLabel}
        />
      </div>

      <details className="wa-thesis" open>
        <summary className="wa-thesis-summary">
          <h2 className="wa-thesis-heading">
            <E k="overview.thesis.summaryLabel" v={content.text("overview.thesis.summaryLabel")} label="Thesis heading" />
          </h2>
          {/* The native <details> marker is hidden by the design, which left
              this reading as a plain heading nobody knew to press. */}
          <span className="wa-thesis-toggle">
            <span className="when-closed">
              <E k="overview.thesis.expandLabel" v={content.text("overview.thesis.expandLabel")} label="Thesis — expand label" />
            </span>
            <span className="when-open">
              <E k="overview.thesis.shrinkLabel" v={content.text("overview.thesis.shrinkLabel")} label="Thesis — shrink label" />
            </span>
          </span>
        </summary>
        <div className="wa-thesis-body">
          <E k="overview.thesis.intro" v={content.text("overview.thesis.intro")} label="Thesis intro" as="p" multiline />
          <EList
            k="overview.thesis.items"
            items={content.list("overview.thesis.items")}
            label="Thesis bullets"
            itemLabel="Bullet"
          />
          <div className="wa-thesis-rule" />
          <E k="overview.thesis.needs" v={content.text("overview.thesis.needs")} label="Thesis — what I need" as="p" multiline />
          <E k="overview.thesis.expand" v={content.text("overview.thesis.expand")} label="Thesis — looking ahead" as="p" multiline />
        </div>
      </details>

      <div className="wa-card">
        <div className="wa-section-head">
          <div>
            <div className="wa-eyebrow">
              {isMtd ? (
                <E k="overview.work.label" v={content.text("overview.work.label")} label="Work block eyebrow" />
              ) : (
                <E
                  k="overview.work.label.rolling"
                  v={content.text("overview.work.label.rolling")}
                  label="Work block eyebrow (30 days)"
                />
              )}
            </div>
            <h2 className="wa-h2">
              {isMtd ? (
                <E k="overview.work.title" v={content.text("overview.work.title")} label="Work block title" />
              ) : (
                <E
                  k="overview.work.title.rolling"
                  v={content.text("overview.work.title.rolling")}
                  label="Work block title (30 days)"
                />
              )}
            </h2>
            <p className="wa-page-sub">
              <E k="overview.work.sub" v={content.text("overview.work.sub")} label="Work block subtitle" multiline />
            </p>
          </div>
        </div>
        {workItems.length === 0 ? (
          <div className="wa-empty wa-empty-slim">
            <p>
              {isMtd ? (
                <E k="overview.work.empty" v={content.text("overview.work.empty")} label="Work block empty state" />
              ) : (
                <E
                  k="overview.work.empty.rolling"
                  v={content.text("overview.work.empty.rolling")}
                  label="Work block empty state (30 days)"
                />
              )}
            </p>
          </div>
        ) : (
          <div className="wa-work-list">
            {workItems.map((item, i) => (
              <div key={i} className="wa-work-item">
                <span className="wa-work-tick">✓</span>
                <div>
                  <b>{item.title}</b>
                  <span>{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="wa-kpis">
        <article className="wa-kpi">
          <div className="wa-kpi-label">
            <E k="overview.kpi.leads.label" v={content.text("overview.kpi.leads.label")} label="Leads KPI label" />
          </div>
          <div className="wa-kpi-value">
            <Num m={metric(`leads.real:${window}`)} clientId={client.id} label="Real leads this period" />
          </div>
          <div className="wa-kpi-detail">
            <Num m={metric(`leads.split:${window}`)} clientId={client.id} label="Leads split (free vs. paid)" />
          </div>
        </article>

        <article className="wa-kpi">
          <div className="wa-kpi-label">
            <E k="overview.kpi.cpl.label" v={content.text("overview.kpi.cpl.label")} label="Cost per lead KPI label" />
          </div>
          <div className="wa-kpi-value">
            <Num m={metric(`lsa.cpl:${window}`)} clientId={client.id} label="Cost per LSA lead" />
          </div>
          <div className="wa-kpi-detail">
            <Num m={metric(`lsa.cpl.support:${window}`)} clientId={client.id} label="LSA spend detail" />
          </div>
        </article>

        <article className="wa-kpi">
          <div className="wa-kpi-label">
            <E k="overview.kpi.pages.label" v={content.text("overview.kpi.pages.label")} label="Pages showing KPI label" />
          </div>
          <div className="wa-kpi-value">
            <Num m={metric("gsc.pagesShowing")} clientId={client.id} label="Pages showing on Google" />
          </div>
          <div className="wa-kpi-detail">
            <Num m={metric("gsc.pagesShowing.support")} clientId={client.id} label="Pages processing detail" />
          </div>
        </article>

        <article className="wa-kpi">
          <div className="wa-kpi-label">
            <E k="overview.kpi.reviews.label" v={content.text("overview.kpi.reviews.label")} label="Reviews KPI label" />
          </div>
          <div className="wa-kpi-value">
            <Num m={metric("reviews.count")} clientId={client.id} label="Google review count" />
          </div>
          <div className="wa-kpi-detail">
            <Num m={metric("reviews.support")} clientId={client.id} label="Reviews detail" />
          </div>
          <a className="wa-kpi-link" href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer">
            <E k="overview.kpi.reviews.link" v={content.text("overview.kpi.reviews.link")} label="Reviews link text" />
          </a>
        </article>
      </div>

      <div className="wa-card">
        <div className="wa-section-head">
          <div>
            <div className="wa-eyebrow">
              <E k="overview.needsYou.title" v={content.text("overview.needsYou.title")} label="Latest leads title" />
            </div>
            <h2 className="wa-h2">
              <E k="overview.needsYou.sub" v={content.text("overview.needsYou.sub")} label="Latest leads subtitle" />
            </h2>
            <p className="wa-page-sub">
              <E k="overview.needsYou.hint" v={content.text("overview.needsYou.hint")} label="Latest leads hint" multiline />
            </p>
          </div>
        </div>
        {latestLeads.length === 0 ? (
          <div className="wa-empty wa-empty-slim">
            <p>
              <E k="overview.needsYou.empty" v={content.text("overview.needsYou.empty")} label="Latest leads empty state" />
            </p>
          </div>
        ) : (
          <LatestLeads leads={latestLeads} />
        )}
      </div>

    </EditProvider>
  );
}
