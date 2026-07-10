import { getScopedContext } from "@/lib/auth";
import { getDashboardClient } from "@/lib/dashboard-data";
import { computeActivityStats, computeMetricStatus, type MetricsPeriod } from "@/lib/dashboard-compute";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { AudienceFilter } from "@/components/dashboard/AudienceFilter";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { MetricCard } from "@/components/dashboard/MetricCard";
import type { MetricKey } from "@prisma/client";

const METRIC_LABELS: Record<MetricKey, string> = {
  EMAILS_SENT: "Emails Sent",
  POSITIVE_REPLIES: "Positive Replies",
  QUALIFIED_APPTS: "Qualified Appointments",
  POSITIVE_REPLY_RATE: "Positive Reply %",
  EMAILS_PER_BOOKED: "Emails per Booked Appt",
  EMAILS_PER_QUALIFIED: "Emails per Qualified Appt",
};

const METRIC_ORDER: MetricKey[] = [
  "EMAILS_SENT",
  "POSITIVE_REPLIES",
  "QUALIFIED_APPTS",
  "POSITIVE_REPLY_RATE",
  "EMAILS_PER_BOOKED",
  "EMAILS_PER_QUALIFIED",
];

const VALID_PERIODS = new Set([
  "LAST_WEEK",
  "LAST_2_WEEKS",
  "LAST_MONTH",
  "LAST_90_DAYS",
  "ALL_TIME",
]);

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string; period?: string }>;
}) {
  const { audience: audienceId, period } = await searchParams;
  const ctx = await getScopedContext();
  if (!ctx.clientId) throw new Error("CLIENT user has no clientId assigned");
  const client = await getDashboardClient(ctx.clientId);

  const selectedAudienceId = audienceId && client.audiences.some((a) => a.id === audienceId) ? audienceId : null;
  const selectedPeriod = (VALID_PERIODS.has(period ?? "") ? period : "ALL_TIME") as MetricsPeriod;
  const stats = computeActivityStats(client, selectedAudienceId, selectedPeriod);

  // raw numeric value (for status comparison) + display string, per metric
  const rawValues: Record<MetricKey, number> = {
    EMAILS_SENT: stats.emailsSent,
    POSITIVE_REPLIES: stats.positiveReplies,
    QUALIFIED_APPTS: stats.appointmentsBooked,
    POSITIVE_REPLY_RATE: stats.emailsSent > 0 ? (stats.positiveReplies / stats.emailsSent) * 100 : 0,
    EMAILS_PER_BOOKED: stats.appointmentsBooked > 0 ? stats.emailsSent / stats.appointmentsBooked : 0,
    EMAILS_PER_QUALIFIED: stats.qualifiedCount > 0 ? stats.emailsSent / stats.qualifiedCount : 0,
  };
  const displayValues: Record<MetricKey, string> = {
    EMAILS_SENT: stats.emailsSent.toLocaleString("en-US"),
    POSITIVE_REPLIES: stats.positiveReplies.toLocaleString("en-US"),
    QUALIFIED_APPTS: stats.appointmentsBooked.toLocaleString("en-US"),
    POSITIVE_REPLY_RATE: stats.emailsSent > 0 ? `${rawValues.POSITIVE_REPLY_RATE.toFixed(2)}%` : "—",
    EMAILS_PER_BOOKED: stats.appointmentsBooked > 0 ? Math.round(rawValues.EMAILS_PER_BOOKED).toLocaleString("en-US") : "—",
    EMAILS_PER_QUALIFIED: stats.qualifiedCount > 0 ? Math.round(rawValues.EMAILS_PER_QUALIFIED).toLocaleString("en-US") : "—",
  };

  const configByKey = new Map(client.metricConfigs.map((c) => [c.metricKey, c]));

  return (
    <>
      <div className="wa-page-head">
        <div>
          <h1 className="wa-page-title">Metrics</h1>
          <div className="wa-page-sub">Track campaign performance and key conversion metrics.</div>
        </div>
        <div className="wa-page-controls">
          <AudienceFilter audiences={client.audiences.map((a) => ({ id: a.id, name: a.name }))} />
          <PeriodFilter />
        </div>
      </div>

      <div className="wa-kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {METRIC_ORDER.map((key) => {
          const config = configByKey.get(key);
          const status = computeMetricStatus(rawValues[key], config?.targetMin ?? null, config?.targetMax ?? null);
          return (
            <MetricCard
              key={key}
              label={METRIC_LABELS[key]}
              value={displayValues[key]}
              targetLabel={config?.targetLabel ?? "—"}
              status={status}
              tips={(config?.tips as string[] | undefined) ?? []}
            />
          );
        })}
      </div>

      <ActivityChart data={stats.chartData} bounceRate={stats.bounceRate} />
    </>
  );
}
