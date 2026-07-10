import { formatCallWhen, formatDayLabel, formatDealValue } from "@/lib/format";
import type { ChartDay } from "@/components/dashboard/ActivityChart";
import type { MilestoneVM } from "@/components/dashboard/Journey";
import type { OnboardingStepVM } from "@/components/dashboard/Onboarding";
import type { PipelineStageVM } from "@/components/dashboard/Pipeline";
import type { AppointmentVM } from "@/components/dashboard/Appointments";
import type { DashboardClient } from "@/lib/dashboard-data";

const STAGE_ORDER = ["STAGE_1", "STAGE_2", "STAGE_3", "STAGE_4"] as const;

export function computeLaunchState(client: DashboardClient) {
  const now = new Date();
  const isPreLaunch = !client.launchDate || client.launchDate > now;
  const daysToLaunch = client.launchDate
    ? Math.max(0, Math.ceil((client.launchDate.getTime() - now.getTime()) / 86_400_000))
    : null;
  const daySinceStart = Math.max(
    0,
    Math.floor((now.getTime() - client.createdAt.getTime()) / 86_400_000),
  );
  return { isPreLaunch, daysToLaunch, daySinceStart };
}

export type MetricsPeriod = "LAST_WEEK" | "LAST_2_WEEKS" | "LAST_MONTH" | "LAST_90_DAYS" | "ALL_TIME";

const PERIOD_DAYS: Record<MetricsPeriod, number | null> = {
  LAST_WEEK: 7,
  LAST_2_WEEKS: 14,
  LAST_MONTH: 30,
  LAST_90_DAYS: 90,
  ALL_TIME: null,
};

export const PERIOD_LABELS: Record<MetricsPeriod, string> = {
  LAST_WEEK: "Last week",
  LAST_2_WEEKS: "Last 2 weeks",
  LAST_MONTH: "Last month",
  LAST_90_DAYS: "Last 90 days",
  ALL_TIME: "All time",
};

function periodCutoff(period: MetricsPeriod): Date | null {
  const days = PERIOD_DAYS[period];
  if (days === null) return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

// audienceId=null means "All audiences" (uses the client-level aggregate).
export function computeActivityStats(
  client: DashboardClient,
  audienceId: string | null,
  period: MetricsPeriod = "ALL_TIME",
) {
  const allDailyStats = audienceId
    ? (client.audiences.find((a) => a.id === audienceId)?.dailyStats ?? [])
    : client.dailyStats;

  const cutoff = periodCutoff(period);
  const dailyStats = cutoff ? allDailyStats.filter((s) => s.date >= cutoff) : allDailyStats;

  const chartWindow = dailyStats.slice(-30);
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

  const emailsSent = dailyStats.reduce((sum, s) => sum + s.sends, 0);
  const positiveReplies = dailyStats.reduce((sum, s) => sum + s.positiveReplies, 0);
  const appointmentsBooked = dailyStats.reduce((sum, s) => sum + s.apptsBooked, 0);

  const allPipeline = audienceId
    ? client.pipeline.filter((p) => p.audienceId === audienceId)
    : client.pipeline;
  const pipeline = cutoff ? allPipeline.filter((p) => p.createdAt >= cutoff) : allPipeline;
  const pipelineValue = pipeline
    .filter((p) => p.stage !== "STAGE_1")
    .reduce((sum, p) => sum + (p.dealValue ?? 0), 0);
  const qualifiedCount = pipeline.filter((p) => p.qualified).length;

  return {
    chartData,
    bounceRate,
    emailsSent,
    positiveReplies,
    appointmentsBooked,
    pipelineValue,
    qualifiedCount,
  };
}

export type MetricStatusVM = "ON_TRACK" | "NEEDS_ATTENTION";

export function computeMetricStatus(
  value: number,
  targetMin: number | null,
  targetMax: number | null,
): MetricStatusVM {
  if (targetMin !== null && value < targetMin) return "NEEDS_ATTENTION";
  if (targetMax !== null && value > targetMax) return "NEEDS_ATTENTION";
  return "ON_TRACK";
}

export function computeMilestones(client: DashboardClient): MilestoneVM[] {
  return client.milestones.map((m) => ({
    label: m.label,
    subLabel: m.subLabel,
    state: m.state,
    progress:
      m.currentValue !== null && m.targetValue !== null && m.targetValue > 0
        ? m.currentValue / m.targetValue
        : null,
  }));
}

export function computeOnboarding(client: DashboardClient): OnboardingStepVM[] {
  return client.onboarding.map((o) => ({
    id: o.id,
    label: o.label,
    dayLabel: o.dayLabel,
    state: o.state,
    ctaLabel: o.ctaLabel,
    ctaUrl: o.ctaUrl,
    clientActionable: o.clientActionable,
  }));
}

export function computePipelineStages(
  client: DashboardClient,
  audienceId: string | null,
): { stages: PipelineStageVM[]; isEmpty: boolean } {
  const entries = audienceId
    ? client.pipeline.filter((p) => p.audienceId === audienceId)
    : client.pipeline;
  const stageLabels = (client.stageLabels as Record<string, string>) ?? {};

  const byStage = STAGE_ORDER.map((key) => ({
    key,
    label: stageLabels[key] ?? key,
    entries: entries.filter((p) => p.stage === key),
  }));

  const stages: PipelineStageVM[] = byStage.map((s, i) => {
    const stageValue = s.entries.reduce((sum, e) => sum + (e.dealValue ?? 0), 0);
    const isFirstStage = i === 0;
    const isBookedStage = i === 1;
    const isLastStage = i === byStage.length - 1;
    const note = isFirstStage
      ? "In conversation or nurturing"
      : isBookedStage && stageValue > 0
        ? `${formatDealValue(stageValue)} est. pipeline`
        : isLastStage
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

  return { stages, isEmpty: entries.length === 0 };
}

export function computeAppointments(
  client: DashboardClient,
  audienceId: string | null,
  limit?: number,
): AppointmentVM[] {
  const entries = audienceId
    ? client.pipeline.filter((p) => p.audienceId === audienceId)
    : client.pipeline;
  const withCall = entries
    .filter((p) => p.callDateTime)
    .sort((a, b) => a.callDateTime!.getTime() - b.callDateTime!.getTime());
  const limited = limit ? withCall.slice(0, limit) : withCall;
  return limited.map((p) => ({
    when: formatCallWhen(p.callDateTime!, client.timezone),
    contactName: p.contactName,
    company: p.company,
    topic: [p.notes, p.dealValue ? formatDealValue(p.dealValue) : null].filter(Boolean).join(" · "),
    status: p.callStatus ?? "PENDING",
  }));
}

// "Needs your attention" style items for the Overview page (v1.1, D21):
// completed appointments with no outcome marked yet, plus onboarding
// steps the client can approve directly.
export function computeClientActionItems(client: DashboardClient) {
  const now = new Date();
  const items: { label: string; status: string; href: string }[] = [];

  const pendingOutcomeCount = client.pipeline.filter(
    (p) =>
      p.callDateTime &&
      p.callDateTime < now &&
      !["HELD", "NO_SHOW"].includes(p.callStatus ?? ""),
  ).length;
  if (pendingOutcomeCount > 0) {
    items.push({
      label: `Mark outcomes for ${pendingOutcomeCount} completed appointment${pendingOutcomeCount === 1 ? "" : "s"}`,
      status: "Waiting on client",
      href: "/appointments",
    });
  }

  for (const step of client.onboarding) {
    if (step.clientActionable && step.state === "CURRENT") {
      items.push({ label: step.label, status: "Needs review", href: "/roadmap" });
    }
  }

  return items;
}
