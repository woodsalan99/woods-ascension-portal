import { getDashboardScope } from "@/lib/dashboard-scope";
import { prisma } from "@/lib/prisma";
import { getContent } from "@/lib/content";
import { resolveMetrics } from "@/lib/ls-metrics";
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
export async function LsOverview() {
  const scope = await getDashboardScope();
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: scope.clientId },
    select: { id: true, heroName: true, name: true, timezone: true },
  });

  const content = await getContent(client.id);
  const monthKey = monthKeyInTimezone(new Date(), client.timezone);

  const metricKeys = [
    `leads.real:${monthKey}`,
    `leads.split:${monthKey}`,
    `lsa.cpl:${monthKey}`,
    `lsa.cpl.support:${monthKey}`,
    "gsc.pagesShowing",
    "gsc.pagesShowing.support",
    "reviews.count",
    "reviews.support",
    `junk.blocked:${monthKey}`,
  ];
  const metrics = await resolveMetrics(client.id, client.timezone, metricKeys);
  const metric = (k: string) => metrics.get(k)!;

  const monthlyWork = await prisma.monthlyWork.findUnique({
    where: { clientId_month: { clientId: client.id, month: monthKey } },
  });
  const workItems = (monthlyWork?.items as { title: string; detail: string }[] | null) ?? [];

  const now = new Date();
  const dateRangeLabel = `${now.toLocaleDateString("en-US", { month: "long", timeZone: client.timezone })} 1 – ${now.toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", timeZone: client.timezone },
  )}`;

  const needsYou = await prisma.serviceLead.findMany({
    where: {
      clientId: client.id,
      stage: { notIn: ["JOB_WON", "REVIEW_COMPLETE", "LOST"] },
      nextActionAt: { lte: now },
    },
    orderBy: { nextActionAt: "asc" },
    take: 5,
    select: { id: true, name: true, nextActionLabel: true },
  });

  const junk = metric(`junk.blocked:${monthKey}`);
  const junkIsZero = !junk.overridden && junk.display === "0";

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
        <span className="wa-weekbadge">{dateRangeLabel}</span>
      </div>

      <details className="wa-thesis" open>
        <summary className="wa-thesis-summary">
          <h2 className="wa-thesis-heading">
            <E k="overview.thesis.summaryLabel" v={content.text("overview.thesis.summaryLabel")} label="Thesis heading" />
          </h2>
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
              <E k="overview.work.label" v={content.text("overview.work.label")} label="Work block eyebrow" />
            </div>
            <h2 className="wa-h2">
              <E k="overview.work.title" v={content.text("overview.work.title")} label="Work block title" />
            </h2>
            <p className="wa-page-sub">
              <E k="overview.work.sub" v={content.text("overview.work.sub")} label="Work block subtitle" multiline />
            </p>
          </div>
        </div>
        {workItems.length === 0 ? (
          <div className="wa-empty wa-empty-slim">
            <p>
              <E k="overview.work.empty" v={content.text("overview.work.empty")} label="Work block empty state" />
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
            <Num m={metric(`leads.real:${monthKey}`)} clientId={client.id} label="Real customers this month" />
          </div>
          <div className="wa-kpi-detail">
            <Num m={metric(`leads.split:${monthKey}`)} clientId={client.id} label="Leads split (free vs. paid)" />
          </div>
        </article>

        <article className="wa-kpi">
          <div className="wa-kpi-label">
            <E k="overview.kpi.cpl.label" v={content.text("overview.kpi.cpl.label")} label="Cost per lead KPI label" />
          </div>
          <div className="wa-kpi-value">
            <Num m={metric(`lsa.cpl:${monthKey}`)} clientId={client.id} label="Cost per LSA lead" />
          </div>
          <div className="wa-kpi-detail">
            <Num m={metric(`lsa.cpl.support:${monthKey}`)} clientId={client.id} label="LSA spend detail" />
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
        </article>
      </div>

      <div className="wa-card">
        <div className="wa-section-head">
          <div>
            <div className="wa-eyebrow">
              <E k="overview.needsYou.title" v={content.text("overview.needsYou.title")} label="Needs-you title" />
            </div>
            <h2 className="wa-h2">
              <E k="overview.needsYou.sub" v={content.text("overview.needsYou.sub")} label="Needs-you subtitle" />
            </h2>
          </div>
        </div>
        {needsYou.length === 0 ? (
          <div className="wa-empty wa-empty-slim">
            <p>
              <E k="overview.needsYou.empty" v={content.text("overview.needsYou.empty")} label="Needs-you empty state" />
            </p>
          </div>
        ) : (
          <div className="wa-ob-list">
            {needsYou.map((lead) => (
              <a key={lead.id} href="/leads" className="wa-ob-item" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="wa-ob-body">
                  <div className="wa-ob-step">{lead.name ?? "Name hidden by Google"}</div>
                </div>
                <span className="wa-ob-now">{lead.nextActionLabel ?? "Follow up"} →</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="wa-card">
        <div className="wa-kpi-label">
          <E k="overview.junk.title" v={content.text("overview.junk.title")} label="Junk-blocked title" />
        </div>
        {junkIsZero ? (
          <p className="wa-page-sub" style={{ marginTop: 8 }}>
            <E k="overview.junk.empty" v={content.text("overview.junk.empty")} label="Junk-blocked empty state" />
          </p>
        ) : (
          <>
            <h2 className="wa-h2" style={{ marginTop: 5 }}>
              <Num m={junk} clientId={client.id} label="Junk blocked this month" /> blocked
            </h2>
            <p className="wa-page-sub">
              <E k="overview.junk.sub" v={content.text("overview.junk.sub")} label="Junk-blocked subtitle" />
            </p>
          </>
        )}
      </div>
    </EditProvider>
  );
}
