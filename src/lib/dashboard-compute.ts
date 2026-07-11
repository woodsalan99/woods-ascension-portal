import { formatCallDay, formatDayLabel, formatDealValue } from "@/lib/format";
import { dateKeyInTimezone } from "@/lib/timezone";
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

export type MetricsPeriod =
  | "THIS_WEEK"
  | "LAST_WEEK"
  | "LAST_2_WEEKS"
  | "LAST_30_DAYS"
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "LAST_90_DAYS"
  | "ALL_TIME";

export const PERIOD_LABELS: Record<MetricsPeriod, string> = {
  THIS_WEEK: "This week",
  LAST_WEEK: "Last week",
  LAST_2_WEEKS: "Last 2 weeks",
  LAST_30_DAYS: "Last 30 days",
  THIS_MONTH: "This month",
  LAST_MONTH: "Last month",
  LAST_90_DAYS: "Last 90 days",
  ALL_TIME: "All time",
};

export const PERIOD_ORDER: MetricsPeriod[] = [
  "THIS_WEEK",
  "LAST_WEEK",
  "LAST_2_WEEKS",
  "LAST_30_DAYS",
  "THIS_MONTH",
  "LAST_MONTH",
  "LAST_90_DAYS",
  "ALL_TIME",
];

// All boundaries computed in UTC to match date-only DailyStat storage
// (UTC midnight). Week starts Monday. Returns a half-open range
// [start, end): start=null means "since the beginning".
function startOfUtcWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // 0 = Monday
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

export function periodRange(period: MetricsPeriod): { start: Date | null; end: Date } {
  const now = new Date();
  const rolling = (days: number) => ({ start: new Date(now.getTime() - days * 86_400_000), end: now });
  const thisWeekStart = startOfUtcWeek(now);
  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  switch (period) {
    case "THIS_WEEK":
      return { start: thisWeekStart, end: now };
    case "LAST_WEEK": {
      const start = new Date(thisWeekStart.getTime() - 7 * 86_400_000);
      return { start, end: thisWeekStart };
    }
    case "LAST_2_WEEKS":
      return rolling(14);
    case "LAST_30_DAYS":
      return rolling(30);
    case "THIS_MONTH":
      return { start: thisMonthStart, end: now };
    case "LAST_MONTH": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      return { start, end: thisMonthStart };
    }
    case "LAST_90_DAYS":
      return rolling(90);
    case "ALL_TIME":
      return { start: null, end: now };
  }
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

  const { start, end } = periodRange(period);
  const inRange = (d: Date) => (!start || d >= start) && d < end;
  const dailyStats = allDailyStats.filter((s) => inRange(s.date));

  // Effective number of days the window spans — used to scale weekly/daily
  // targets. For a bounded period it's the range length; for ALL_TIME it's
  // the span from the earliest data point to now (min 1).
  let periodDays: number;
  if (start) {
    periodDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  } else if (allDailyStats.length > 0) {
    const earliest = allDailyStats[0].date.getTime();
    periodDays = Math.max(1, Math.round((end.getTime() - earliest) / 86_400_000));
  } else {
    periodDays = 1;
  }

  const allPipeline = audienceId
    ? client.pipeline.filter((p) => p.audienceId === audienceId)
    : client.pipeline;

  // Per-day appointment info for the chart: which appointments are on each
  // calendar day (by the appointment/discovery-call date), and whether one
  // actually occurred (HELD). Keyed by client-TZ date so it aligns with the
  // DailyStat day keys.
  const apptByDay = new Map<string, { names: string[]; occurred: boolean }>();
  for (const p of allPipeline) {
    // A lead can have several calls (discovery/sales); mark each on its day.
    // Key by UTC date to align with the chart's day keys (DailyStat dates and
    // admin-entered call dates are both UTC-midnight date-only).
    for (const c of p.calls) {
      const key = c.date.toISOString().slice(0, 10);
      const entry = apptByDay.get(key) ?? { names: [], occurred: false };
      entry.names.push(p.contactName || p.email || "Appointment");
      if (p.callStatus === "HELD") entry.occurred = true;
      apptByDay.set(key, entry);
    }
  }

  const chartWindow = dailyStats.slice(-30);
  const todayKey = dateKeyInTimezone(new Date(), client.timezone);
  const chartData: ChartDay[] = chartWindow.map((s) => {
    const key = s.date.toISOString().slice(0, 10);
    const appt = apptByDay.get(key);
    return {
      d: formatDayLabel(s.date),
      sends: s.sends,
      replies: s.positiveReplies,
      totalReplies: s.totalReplies,
      bounces: s.bounces,
      appts: appt ? appt.names.length : 0,
      apptNames: appt?.names ?? [],
      apptOccurred: appt?.occurred ?? false,
      positiveReplyEmails: (s.positiveReplyEmails as string[] | null) ?? [],
      isToday: key === todayKey,
    };
  });
  const windowSends = chartWindow.reduce((sum, s) => sum + s.sends, 0);
  const windowBounces = chartWindow.reduce((sum, s) => sum + s.bounces, 0);
  const bounceRate = windowSends > 0 ? (windowBounces / windowSends) * 100 : null;

  const emailsSent = dailyStats.reduce((sum, s) => sum + s.sends, 0);
  const totalReplies = dailyStats.reduce((sum, s) => sum + s.totalReplies, 0);
  const positiveReplies = dailyStats.reduce((sum, s) => sum + s.positiveReplies, 0);
  const appointmentsBooked = dailyStats.reduce((sum, s) => sum + s.apptsBooked, 0);

  const pipeline = allPipeline.filter((p) => inRange(p.createdAt));
  const pipelineValue = pipeline
    .filter((p) => p.stage !== "STAGE_1")
    .reduce((sum, p) => sum + (p.dealValue ?? 0), 0);
  // "Qualified appointments" = calls that actually occurred (HELD) and were
  // marked qualified — not just any qualified lead, and not just booked.
  const qualifiedCount = pipeline.filter((p) => p.callStatus === "HELD" && p.qualified).length;

  return {
    chartData,
    bounceRate,
    emailsSent,
    totalReplies,
    positiveReplies,
    appointmentsBooked,
    pipelineValue,
    qualifiedCount,
    periodDays,
  };
}

export type MetricStatusVM = "ON_TRACK" | "NEEDS_ATTENTION";
export type MetricCadenceVM = "DAILY" | "WEEKLY" | "PERPETUAL";

// Scale a base-unit target bound to the selected window. WEEKLY targets are
// per-week so multiply by weeks-in-window; DAILY by days; PERPETUAL (rates,
// ratios) don't scale.
export function scaleTargetBound(
  bound: number | null,
  cadence: MetricCadenceVM,
  periodDays: number,
): number | null {
  if (bound === null) return null;
  if (cadence === "WEEKLY") return bound * (periodDays / 7);
  if (cadence === "DAILY") return bound * periodDays;
  return bound;
}

export function computeMetricStatus(
  value: number,
  scaledMin: number | null,
  scaledMax: number | null,
): MetricStatusVM {
  if (scaledMin !== null && value < scaledMin) return "NEEDS_ATTENTION";
  if (scaledMax !== null && value > scaledMax) return "NEEDS_ATTENTION";
  return "ON_TRACK";
}

// Human-readable "healthy range" text for a KPI card, using the scaled
// bounds. isPercent formats as % (for reply rate).
export function describeTargetRange(
  scaledMin: number | null,
  scaledMax: number | null,
  isPercent: boolean,
): string | null {
  const fmt = (n: number) =>
    isPercent
      ? `${n.toFixed(1)}%`
      : Math.round(n).toLocaleString("en-US");
  if (scaledMin !== null && scaledMax !== null) return `${fmt(scaledMin)}–${fmt(scaledMax)} is healthy`;
  if (scaledMin !== null) return `${fmt(scaledMin)} or more is healthy`;
  if (scaledMax !== null) return `${fmt(scaledMax)} or less is healthy`;
  return null;
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

export type PeriodAppointment = {
  date: string;
  type: "Discovery" | "Sales";
  contactName: string;
  outcome: "Qualified" | "Not qualified" | "No-show" | "Pending";
  notes: string;
};

// Appointment/call events whose date falls inside the selected period —
// for the list under the metrics chart. Sourced from PipelineCall events.
export function computeAppointmentsInPeriod(
  client: DashboardClient,
  audienceId: string | null,
  period: MetricsPeriod,
): PeriodAppointment[] {
  const { start, end } = periodRange(period);
  const inRange = (d: Date) => (!start || d >= start) && d < end;
  const entries = audienceId
    ? client.pipeline.filter((p) => p.audienceId === audienceId)
    : client.pipeline;

  const items: (PeriodAppointment & { ts: number })[] = [];
  for (const p of entries) {
    const outcome: PeriodAppointment["outcome"] =
      p.callStatus === "NO_SHOW"
        ? "No-show"
        : p.callStatus === "HELD"
          ? p.qualified
            ? "Qualified"
            : "Not qualified"
          : "Pending";
    const notes = [p.notes, p.disqualifiedReason].filter(Boolean).join(" · ");
    for (const c of p.calls) {
      if (!inRange(c.date)) continue;
      items.push({
        ts: c.date.getTime(),
        date: formatCallDay(c.date),
        type: c.type === "DISCOVERY" ? "Discovery" : "Sales",
        contactName: p.contactName,
        outcome,
        notes: [notes, c.note].filter(Boolean).join(" · "),
      });
    }
  }
  return items.sort((a, b) => b.ts - a.ts).map(({ ts: _ts, ...rest }) => rest);
}

export function computeAppointments(
  client: DashboardClient,
  audienceId: string | null,
  limit?: number,
): AppointmentVM[] {
  const entries = audienceId
    ? client.pipeline.filter((p) => p.audienceId === audienceId)
    : client.pipeline;
  // Overview shows only genuinely upcoming appointments: today or later and
  // not already held/no-showed.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const withCall = entries
    .filter(
      (p) =>
        p.callDateTime &&
        p.callStatus !== "HELD" &&
        p.callStatus !== "NO_SHOW" &&
        p.callDateTime >= todayStart,
    )
    .sort((a, b) => a.callDateTime!.getTime() - b.callDateTime!.getTime());
  const limited = limit ? withCall.slice(0, limit) : withCall;
  return limited.map((p) => ({
    when: formatCallDay(p.callDateTime!),
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
