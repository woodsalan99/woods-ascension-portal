import Link from "next/link";
import { requireClientType } from "@/lib/dashboard-scope";
import { prisma } from "@/lib/prisma";
import { getContent } from "@/lib/content";
import { periodRange, resolveMetrics } from "@/lib/ls-metrics";
import { formatMonthKey } from "@/lib/timezone";
import { EditProvider } from "@/components/ls/EditProvider";
import { E } from "@/components/ls/Editable";
import { leadLabel } from "@/lib/lead-label";
import type { ContentKey } from "@/content/local-services";

// Each month's recap is one MonthlyWork row. `items` is the same list that
// feeds the Overview's "what we built for you this month" block — written
// once, shown in both places, so the two can never drift apart.
type WorkItem = { title: string; detail?: string; recap?: string };

// Same wording as the leads board, so a client reading both sees one vocabulary.
const SOURCE_LABEL: Record<string, string> = {
  LSA: "Google Ads",
  GBP_CALL: "Google Maps call",
  WEBSITE_FORM: "Website form",
  REFERRAL: "Referral",
  OTHER: "Other",
};

export default async function RecapPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const scope = await requireClientType("LOCAL_SERVICES");
  const { m } = await searchParams;
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: scope.clientId },
    select: { id: true, timezone: true },
  });
  const content = await getContent(client.id);

  const all = await prisma.monthlyWork.findMany({
    where: { clientId: client.id },
    orderBy: { month: "desc" },
    select: { month: true },
  });
  const months = all.map((r) => r.month);

  // ?m= picks a month; otherwise the most recent one written.
  const selected = m && months.includes(m) ? m : (months[0] ?? null);

  if (!selected) {
    return (
      <EditProvider clientId={client.id} canEdit={scope.isPreview}>
        <div className="wa-page-head">
          <div>
            <div className="wa-eyebrow">
              <E k="recap.eyebrow" v={content.text("recap.eyebrow")} label="Recap eyebrow" />
            </div>
            <h1 className="wa-page-title">Monthly recap</h1>
            <div className="wa-page-sub">
              <E k="recap.sub" v={content.text("recap.sub")} label="Recap subtitle" multiline />
            </div>
          </div>
        </div>
        <div className="wa-card">
          <div className="wa-empty">
            <div className="wa-empty-mark">◇</div>
            <p>
              <b>
                <E k="recap.empty.title" v={content.text("recap.empty.title")} label="Recap empty title" />
              </b>
            </p>
            <p>
              <E k="recap.empty.body" v={content.text("recap.empty.body")} label="Recap empty body" multiline />
            </p>
          </div>
        </div>
      </EditProvider>
    );
  }

  const work = await prisma.monthlyWork.findUniqueOrThrow({
    where: { clientId_month: { clientId: client.id, month: selected } },
  });

  const metrics = await resolveMetrics(client.id, client.timezone, [
    `leads.real:${selected}`,
    `jobs.won:${selected}`,
    `jobs.wonValue:${selected}`,
    `lsa.spend:${selected}`,
    `junk.blocked:${selected}`,
    "reviews.count",
  ]);
  const val = (k: string) => metrics.get(k)?.display ?? "—";

  // A zero tells the client nothing and can actively mislead: "Junk blocked: 0"
  // for a month before the call filter existed reads as "nothing was filtered",
  // not "we weren't measuring yet". So a zero cell is dropped — except ad spend,
  // where $0 alongside hundreds of impressions is the whole point. Blanks and
  // dashes go too: a resolver returns those when it has nothing to say at all.
  const isEmpty = (v: string) => v === "" || v === "—" || v === "0" || v === "$0";
  const cells = (
    [
      { key: "recap.kpi.leads", label: "Recap KPI — leads", value: val(`leads.real:${selected}`) },
      { key: "recap.kpi.jobs", label: "Recap KPI — jobs won", value: val(`jobs.won:${selected}`) },
      { key: "recap.kpi.value", label: "Recap KPI — work value", value: val(`jobs.wonValue:${selected}`) },
      { key: "recap.kpi.spend", label: "Recap KPI — ad spend", value: val(`lsa.spend:${selected}`), keepZero: true },
      { key: "recap.kpi.junk", label: "Recap KPI — junk blocked", value: val(`junk.blocked:${selected}`) },
      { key: "recap.kpi.reviews", label: "Recap KPI — reviews", value: val("reviews.count") },
    ] satisfies { key: ContentKey; label: string; value: string; keepZero?: boolean }[]
  ).filter((c) => ("keepZero" in c && c.keepZero ? c.value !== "" && c.value !== "—" : !isEmpty(c.value)));

  // "6 leads" on its own asks the client to trust a number. Listing exactly
  // who those six were — name where we have one, where they came from, what
  // they wanted — makes it checkable against their own memory of the month.
  // See D35.
  const { start, end } = periodRange(selected);
  const periodLeads = await prisma.serviceLead.findMany({
    where: {
      clientId: client.id,
      deletedAt: null,
      OR: [{ qualified: null }, { qualified: true }],
      receivedAt: { gte: start, lt: end },
    },
    orderBy: { receivedAt: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      source: true,
      stage: true,
      serviceType: true,
      location: true,
      jobValue: true,
      receivedAt: true,
    },
  });

  const items = (work.items as unknown as WorkItem[]) ?? [];
  const nextMonth = (work.nextMonth as unknown as string[]) ?? [];
  const heroTitle = work.heroTitleManual ?? work.heroTitleAuto;
  const heroSub = work.heroSubManual ?? work.heroSubAuto;

  return (
    <EditProvider clientId={client.id} canEdit={scope.isPreview}>
      <div className="wa-page-head">
        <div>
          <div className="wa-eyebrow">
            <E k="recap.eyebrow" v={content.text("recap.eyebrow")} label="Recap eyebrow" />
          </div>
          <h1 className="wa-page-title">{formatMonthKey(selected)}</h1>
          <div className="wa-page-sub">
            <E k="recap.sub" v={content.text("recap.sub")} label="Recap subtitle" multiline />
          </div>
        </div>
        {months.length > 1 && (
          <div className="wa-month-nav">
            {months
              .slice()
              .reverse()
              .map((mk) =>
                mk === selected ? (
                  <span key={mk} className="current">
                    {formatMonthKey(mk)}
                  </span>
                ) : (
                  <Link key={mk} href={`/recap?m=${mk}`}>
                    {formatMonthKey(mk)}
                  </Link>
                ),
              )}
          </div>
        )}
      </div>

      {heroTitle && (
        <div className="wa-recap-head">
          <div className="wa-eyebrow">
            <E k="recap.headline.label" v={content.text("recap.headline.label")} label="Headline label" />
          </div>
          <h2>{heroTitle}</h2>
          {heroSub && <p>{heroSub}</p>}
        </div>
      )}

      <div
        className="wa-recap-body"
        style={heroTitle ? undefined : { borderTop: "1px solid var(--line)", borderRadius: 14 }}
      >
        <div className="wa-recap-grid">
          {cells.map((c) => (
            <div key={c.key} className="wa-recap-cell">
              <div className="wa-kpi-label">
                <E k={c.key} v={content.text(c.key)} label={c.label} />
              </div>
              <div className="wa-recap-v">{c.value}</div>
            </div>
          ))}
        </div>

        {periodLeads.length > 0 && (
          <div className="wa-lead-breakdown">
            <h3 className="wa-recap-h3">
              <E k="recap.leads.title" v={content.text("recap.leads.title")} label="Lead breakdown heading" />
            </h3>
            <p className="wa-page-sub" style={{ marginBottom: 12 }}>
              <E k="recap.leads.sub" v={content.text("recap.leads.sub")} label="Lead breakdown subtitle" multiline />
            </p>
            <ul className="wa-recap-list wa-lead-lines">
              {periodLeads.map((l) => (
                <li key={l.id}>
                  <b>{leadLabel(l)}</b>
                  {" — "}
                  {[
                    SOURCE_LABEL[l.source],
                    l.serviceType,
                    l.location,
                    l.receivedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {l.stage === "JOB_WON" && (
                    <span className="wa-lead-line-won">
                      {" "}
                      · won{l.jobValue ? ` · $${l.jobValue.toLocaleString("en-US")}` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {items.length > 0 && (
          <>
            <h3 className="wa-recap-h3" style={{ marginTop: 24 }}>
              <E k="recap.did.title" v={content.text("recap.did.title")} label="What we did — heading" /> in{" "}
              {formatMonthKey(selected).split(" ")[0]}
            </h3>
            <ul className="wa-recap-list">
              {items.map((it, i) => (
                <li key={i}>
                  <b>{it.recap ?? it.title}</b>
                  {it.detail && ` — ${it.detail}`}
                </li>
              ))}
            </ul>
          </>
        )}

        {nextMonth.length > 0 && (
          <>
            <h3 className="wa-recap-h3" style={{ marginTop: 24 }}>
              <E k="recap.next.title" v={content.text("recap.next.title")} label="What's coming — heading" />
            </h3>
            <ul className="wa-recap-list">
              {nextMonth.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </>
        )}

        {work.noteFromAlan && (
          <div className="wa-recap-note">
            <div className="wa-kpi-label">
              <E k="recap.note.label" v={content.text("recap.note.label")} label="Note label" />
            </div>
            {work.noteFromAlan}
          </div>
        )}
      </div>
    </EditProvider>
  );
}
