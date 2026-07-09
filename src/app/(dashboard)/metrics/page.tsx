import { getScopedContext } from "@/lib/auth";
import { getDashboardClient } from "@/lib/dashboard-data";
import { computeActivityStats } from "@/lib/dashboard-compute";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { AudienceFilter } from "@/components/dashboard/AudienceFilter";
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

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string }>;
}) {
  const { audience: audienceId } = await searchParams;
  const ctx = await getScopedContext();
  if (!ctx.clientId) throw new Error("CLIENT user has no clientId assigned");
  const client = await getDashboardClient(ctx.clientId);

  const selectedAudienceId = audienceId && client.audiences.some((a) => a.id === audienceId) ? audienceId : null;
  const stats = computeActivityStats(client, selectedAudienceId);

  const pipeline = selectedAudienceId
    ? client.pipeline.filter((p) => p.audienceId === selectedAudienceId)
    : client.pipeline;
  const qualifiedCount = pipeline.filter((p) => p.qualified).length;

  const computedValues: Record<MetricKey, string> = {
    EMAILS_SENT: stats.emailsSent.toLocaleString("en-US"),
    POSITIVE_REPLIES: stats.positiveReplies.toLocaleString("en-US"),
    QUALIFIED_APPTS: stats.appointmentsBooked.toLocaleString("en-US"),
    POSITIVE_REPLY_RATE:
      stats.emailsSent > 0 ? `${((stats.positiveReplies / stats.emailsSent) * 100).toFixed(2)}%` : "—",
    EMAILS_PER_BOOKED:
      stats.appointmentsBooked > 0 ? Math.round(stats.emailsSent / stats.appointmentsBooked).toLocaleString("en-US") : "—",
    EMAILS_PER_QUALIFIED:
      qualifiedCount > 0 ? Math.round(stats.emailsSent / qualifiedCount).toLocaleString("en-US") : "—",
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
        </div>
      </div>

      <div className="wa-kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {METRIC_ORDER.map((key) => {
          const config = configByKey.get(key);
          return (
            <MetricCard
              key={key}
              label={METRIC_LABELS[key]}
              value={computedValues[key]}
              targetLabel={config?.targetLabel ?? "—"}
              status={config?.status ?? "ON_TRACK"}
              tips={(config?.tips as string[] | undefined) ?? []}
            />
          );
        })}
      </div>

      <ActivityChart data={stats.chartData} bounceRate={stats.bounceRate} />
    </>
  );
}
