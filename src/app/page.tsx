import { redirect } from "next/navigation";
import { getScopedContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCallWhen, formatDayLabel, formatDealValue } from "@/lib/format";
import { KPIRow } from "@/components/dashboard/KPIRow";
import { ActivityChart, type ChartDay } from "@/components/dashboard/ActivityChart";
import { Journey, type MilestoneVM } from "@/components/dashboard/Journey";
import { Onboarding, type OnboardingStepVM } from "@/components/dashboard/Onboarding";
import { Pipeline, type PipelineStageVM } from "@/components/dashboard/Pipeline";
import { Appointments, type AppointmentVM } from "@/components/dashboard/Appointments";
import { AlanNote } from "@/components/dashboard/AlanNote";

const STAGE_ORDER = ["STAGE_1", "STAGE_2", "STAGE_3", "STAGE_4"] as const;

export default async function Home() {
  const ctx = await getScopedContext();

  if (ctx.role === "ADMIN") {
    redirect("/admin");
  }

  if (!ctx.clientId) {
    throw new Error("CLIENT user has no clientId assigned");
  }

  const client = await prisma.client.findUniqueOrThrow({
    where: { id: ctx.clientId },
    include: {
      dailyStats: { orderBy: { date: "asc" } },
      milestones: { orderBy: { sortOrder: "asc" } },
      onboarding: { orderBy: { sortOrder: "asc" } },
      pipeline: true,
      notes: { where: { published: true }, orderBy: { weekOf: "desc" }, take: 1 },
    },
  });

  const latestSync = await prisma.syncRun.findFirst({
    where: { status: "SUCCESS" },
    orderBy: { startedAt: "desc" },
  });

  const now = new Date();
  const isPreLaunch = !client.launchDate || client.launchDate > now;
  const daysToLaunch = client.launchDate
    ? Math.max(0, Math.ceil((client.launchDate.getTime() - now.getTime()) / 86_400_000))
    : null;
  const daySinceStart = Math.max(
    0,
    Math.floor((now.getTime() - client.createdAt.getTime()) / 86_400_000),
  );

  // ---- Daily activity chart ----
  const chartWindow = client.dailyStats.slice(-30);
  const chartData: ChartDay[] = chartWindow.map((s) => ({
    d: formatDayLabel(s.date, client.timezone),
    sends: s.sends,
    replies: s.positiveReplies,
    bounces: s.bounces,
    appts: s.apptsBooked,
  }));
  const windowSends = chartWindow.reduce((sum, s) => sum + s.sends, 0);
  const windowBounces = chartWindow.reduce((sum, s) => sum + s.bounces, 0);
  const bounceRate = windowSends > 0 ? (windowBounces / windowSends) * 100 : null;

  // ---- KPIs ----
  const emailsSent = client.dailyStats.reduce((sum, s) => sum + s.sends, 0);
  const positiveReplies = client.dailyStats.reduce((sum, s) => sum + s.positiveReplies, 0);
  const appointmentsBooked = client.dailyStats.reduce((sum, s) => sum + s.apptsBooked, 0);
  const pipelineValue = client.pipeline
    .filter((p) => p.stage !== "STAGE_1")
    .reduce((sum, p) => sum + (p.dealValue ?? 0), 0);

  // ---- Milestones ----
  const milestones: MilestoneVM[] = client.milestones.map((m) => ({
    label: m.label,
    subLabel: m.subLabel,
    state: m.state,
    progress:
      m.currentValue !== null && m.targetValue !== null && m.targetValue > 0
        ? m.currentValue / m.targetValue
        : null,
  }));

  // ---- Onboarding ----
  const onboardingSteps: OnboardingStepVM[] = client.onboarding.map((o) => ({
    label: o.label,
    dayLabel: o.dayLabel,
    state: o.state,
    ctaLabel: o.ctaLabel,
    ctaUrl: o.ctaUrl,
  }));

  // ---- Pipeline ----
  const stageLabels = (client.stageLabels as Record<string, string>) ?? {};
  const pipelineByStage = STAGE_ORDER.map((key) => ({
    key,
    label: stageLabels[key] ?? key,
    entries: client.pipeline.filter((p) => p.stage === key),
  }));
  const pipelineStages: PipelineStageVM[] = pipelineByStage.map((s, i) => {
    const stageValue = s.entries.reduce((sum, e) => sum + (e.dealValue ?? 0), 0);
    const note =
      i === 0
        ? "In conversation or nurturing"
        : stageValue > 0
          ? `${formatDealValue(stageValue)} est. pipeline`
          : i === pipelineByStage.length - 1
            ? "Funded"
            : "In follow-up";
    return {
      key: s.key,
      label: s.label,
      count: s.entries.length,
      note,
      leads: s.entries.map((e) => ({
        contactName: e.contactName,
        company: e.company,
        displayValue: e.dealValue ? formatDealValue(e.dealValue) : (e.notes ?? ""),
      })),
    };
  });
  const pipelineIsEmpty = client.pipeline.length === 0;

  // ---- Appointments ----
  const appointments: AppointmentVM[] = client.pipeline
    .filter((p) => p.callDateTime)
    .sort((a, b) => a.callDateTime!.getTime() - b.callDateTime!.getTime())
    .slice(0, 5)
    .map((p) => ({
      when: formatCallWhen(p.callDateTime!, client.timezone),
      contactName: p.contactName,
      company: p.company,
      topic: [p.notes, p.dealValue ? formatDealValue(p.dealValue) : null]
        .filter(Boolean)
        .join(" · "),
      status: p.callStatus ?? "PENDING",
    }));

  const note = client.notes[0];

  const syncedAgoMinutes = latestSync?.finishedAt
    ? Math.max(0, Math.round((now.getTime() - latestSync.finishedAt.getTime()) / 60_000))
    : null;

  return (
    <div className="wa-shell">
      <div className="wa-topbar">
        <div className="wa-brand">
          <span className="wa-wordmark">Woods Ascension</span>
          <span className="wa-brand-div" />
          <span className="wa-client">{client.heroName ?? client.name} · Client Portal</span>
        </div>
        <div className="wa-top-right">
          <span className="wa-sync">
            <b>●</b>{" "}
            {syncedAgoMinutes !== null
              ? `Synced via Smartlead · ${syncedAgoMinutes} min ago`
              : "Awaiting first sync"}
          </span>
          <div className="wa-avatar">{(client.heroName ?? client.name).charAt(0)}</div>
        </div>
      </div>

      <div className="wa-hero">
        <h1>
          {isPreLaunch ? (
            <>
              Groundwork phase. Every quiet day here is <em>deliberate</em>.
            </>
          ) : (
            <>
              {appointmentsBooked} appointment{appointmentsBooked === 1 ? "" : "s"} booked. The
              next milestone is <em>close</em>.
            </>
          )}
        </h1>
        <span className="wa-weekbadge">Day {daySinceStart}</span>
      </div>

      <KPIRow
        isPreLaunch={isPreLaunch}
        domainsLive={client.domainsLive ?? 0}
        inboxesWarming={client.inboxesWarming ?? 0}
        warmupSends={client.warmupSends ?? 0}
        daysToLaunch={daysToLaunch}
        emailsSent={emailsSent}
        positiveReplies={positiveReplies}
        appointmentsBooked={appointmentsBooked}
        pipelineValue={pipelineValue}
      />

      <ActivityChart data={chartData} bounceRate={bounceRate} />

      <Journey milestones={milestones} />

      <Onboarding steps={onboardingSteps} />

      <Pipeline stages={pipelineStages} totalValue={pipelineValue} isEmpty={pipelineIsEmpty} />

      <Appointments appointments={appointments} isPreLaunch={isPreLaunch} />

      {note && (
        <AlanNote headline={note.headline} body={note.body} videoUrl={note.videoUrl} />
      )}

      <div className="wa-foot">
        <span>Woods Ascension · Outbound performance</span>
        <span>Data via Smartlead API · Updated hourly</span>
      </div>
    </div>
  );
}
