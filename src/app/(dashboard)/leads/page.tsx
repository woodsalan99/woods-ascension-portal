import { requireClientType } from "@/lib/dashboard-scope";
import { prisma } from "@/lib/prisma";
import { KanbanBoard, type LeadCardVM } from "@/components/ls/KanbanBoard";
import { monthKeyInTimezone } from "@/lib/timezone";

const OPEN_STAGES = ["NEW", "CONTACTED", "QUOTE_SENT", "JOB_SCHEDULED"] as const;

export default async function LeadsPage() {
  const scope = await requireClientType("LOCAL_SERVICES");
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: scope.clientId },
    select: { timezone: true },
  });

  const leads = await prisma.serviceLead.findMany({
    where: { clientId: scope.clientId },
    orderBy: { receivedAt: "desc" },
  });

  const cards: LeadCardVM[] = leads.map((l) => ({
    id: l.id,
    stage: l.stage,
    source: l.source,
    name: l.name,
    location: l.location,
    serviceType: l.serviceType,
    message: l.message,
    qualified: l.qualified,
    needsDetails: l.needsDetails,
    jobValue: l.jobValue,
    callRecordId: l.callRecordId,
    callRailUrl: l.callRailUrl,
    nextActionLabel: l.nextActionLabel,
    nextActionAt: l.nextActionAt,
    receivedAt: l.receivedAt,
  }));

  // ---- Stats strip ----
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const openLeads = leads.filter((l) => (OPEN_STAGES as readonly string[]).includes(l.stage));
  const openCount = openLeads.length;

  const needsActionCount = openLeads.filter((l) => l.nextActionAt && l.nextActionAt < tomorrowStart).length;
  const overdueCount = openLeads.filter((l) => l.nextActionAt && l.nextActionAt < todayStart).length;

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const openLeadIds = openLeads.map((l) => l.id);
  const touchedLeadIds =
    openLeadIds.length > 0
      ? new Set(
          (
            await prisma.leadActivity.findMany({
              where: { leadId: { in: openLeadIds }, createdAt: { gte: sevenDaysAgo } },
              select: { leadId: true },
              distinct: ["leadId"],
            })
          ).map((a) => a.leadId),
        )
      : new Set<string>();

  const [monthYear, monthNum] = monthKeyInTimezone(now, client.timezone).split("-").map(Number);
  const monthStart = new Date(Date.UTC(monthYear, monthNum - 1, 1));
  const wonThisMonth = leads.filter((l) => l.stage === "JOB_WON" && l.stageChangedAt >= monthStart);
  const wonValueTotal = wonThisMonth.reduce((sum, l) => sum + (l.jobValue ?? 0), 0);

  return (
    <>
      <div className="wa-page-head">
        <div>
          <div className="wa-eyebrow">Your leads</div>
          <h1 className="wa-page-title">Leads</h1>
          <div className="wa-page-sub">Drag a card across as things move along. Tap any card to add notes.</div>
        </div>
      </div>

      <div className="wa-pipeline-stats">
        <div className="wa-pstat">
          <div className="wa-pstat-label">Still open</div>
          <div className="wa-pstat-value">{openCount}</div>
          <div className="wa-pstat-sub">Not yet won or lost</div>
        </div>
        <div className="wa-pstat">
          <div className="wa-pstat-label">Needs action today</div>
          <div className="wa-pstat-value gold">{needsActionCount}</div>
          <div className="wa-pstat-sub">{overdueCount > 0 ? `${overdueCount} overdue` : "None overdue"}</div>
        </div>
        <div className="wa-pstat">
          <div className="wa-pstat-label">Followed up this week</div>
          <div className="wa-pstat-value">
            {touchedLeadIds.size} <small>of {openCount}</small>
          </div>
          <div className="wa-pstat-sub">Last 7 days</div>
        </div>
        <div className="wa-pstat">
          <div className="wa-pstat-label">Jobs won this month</div>
          <div className="wa-pstat-value green">${(wonValueTotal / 1000).toFixed(1)}K</div>
          <div className="wa-pstat-sub">
            {wonThisMonth.length} job{wonThisMonth.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <KanbanBoard leads={cards} />
    </>
  );
}
