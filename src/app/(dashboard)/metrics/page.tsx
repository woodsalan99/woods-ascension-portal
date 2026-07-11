import { getDashboardScope } from "@/lib/dashboard-scope";
import { getDashboardClient } from "@/lib/dashboard-data";
import {
  computeActivityStats,
  computeAppointmentsInPeriod,
  computeMetricStatus,
  describeTargetRange,
  scaleTargetBound,
  PERIOD_ORDER,
  PERIOD_LABELS,
  type MetricsPeriod,
} from "@/lib/dashboard-compute";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { AudienceFilter } from "@/components/dashboard/AudienceFilter";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { MetricCard, type MetricCardVM } from "@/components/dashboard/MetricCard";
import type { MetricKey } from "@prisma/client";

const METRIC_LABELS: Record<MetricKey, string> = {
  EMAILS_SENT: "Emails Sent",
  POSITIVE_REPLIES: "Positive Replies",
  QUALIFIED_APPTS: "Qualified Appointments",
  POSITIVE_REPLY_RATE: "Positive Reply %",
  EMAILS_PER_BOOKED: "Emails per Booked Appt",
  EMAILS_PER_QUALIFIED: "Emails per Qualified Appt",
};

const VALID_PERIODS = new Set(PERIOD_ORDER);

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string; period?: string }>;
}) {
  const { audience: audienceId, period } = await searchParams;
  const scope = await getDashboardScope();
  const client = await getDashboardClient(scope.clientId);

  const selectedAudienceId = audienceId && client.audiences.some((a) => a.id === audienceId) ? audienceId : null;
  const selectedPeriod = (VALID_PERIODS.has(period as MetricsPeriod) ? period : "ALL_TIME") as MetricsPeriod;
  const stats = computeActivityStats(client, selectedAudienceId, selectedPeriod);
  const periodAppts = computeAppointmentsInPeriod(client, selectedAudienceId, selectedPeriod);

  const rawValues: Record<MetricKey, number> = {
    EMAILS_SENT: stats.emailsSent,
    POSITIVE_REPLIES: stats.positiveReplies,
    QUALIFIED_APPTS: stats.qualifiedCount,
    POSITIVE_REPLY_RATE: stats.totalReplies > 0 ? (stats.positiveReplies / stats.totalReplies) * 100 : 0,
    EMAILS_PER_BOOKED: stats.appointmentsBooked > 0 ? stats.emailsSent / stats.appointmentsBooked : 0,
    EMAILS_PER_QUALIFIED: stats.qualifiedCount > 0 ? stats.emailsSent / stats.qualifiedCount : 0,
  };
  const displayValues: Record<MetricKey, string> = {
    EMAILS_SENT: stats.emailsSent.toLocaleString("en-US"),
    POSITIVE_REPLIES: stats.positiveReplies.toLocaleString("en-US"),
    QUALIFIED_APPTS: stats.qualifiedCount.toLocaleString("en-US"),
    POSITIVE_REPLY_RATE: stats.totalReplies > 0 ? `${rawValues.POSITIVE_REPLY_RATE.toFixed(2)}%` : "—",
    EMAILS_PER_BOOKED: stats.appointmentsBooked > 0 ? Math.round(rawValues.EMAILS_PER_BOOKED).toLocaleString("en-US") : "—",
    EMAILS_PER_QUALIFIED: stats.qualifiedCount > 0 ? Math.round(rawValues.EMAILS_PER_QUALIFIED).toLocaleString("en-US") : "—",
  };

  const configByKey = new Map(client.metricConfigs.map((c) => [c.metricKey, c]));

  const subValues: Partial<Record<MetricKey, string>> = {
    POSITIVE_REPLY_RATE:
      stats.totalReplies > 0
        ? `${stats.positiveReplies.toLocaleString("en-US")} of ${stats.totalReplies.toLocaleString("en-US")} replies`
        : undefined,
  };

  const configCard = (key: MetricKey): MetricCardVM => {
    const config = configByKey.get(key);
    const cadence = config?.cadence ?? "PERPETUAL";
    const scaledMin = scaleTargetBound(config?.targetMin ?? null, cadence, stats.periodDays);
    const scaledMax = scaleTargetBound(config?.targetMax ?? null, cadence, stats.periodDays);
    return {
      label: METRIC_LABELS[key],
      value: displayValues[key],
      subValue: subValues[key],
      rangeText: describeTargetRange(scaledMin, scaledMax, key === "POSITIVE_REPLY_RATE"),
      status: computeMetricStatus(rawValues[key], scaledMin, scaledMax),
      tips: (config?.tips as string[] | undefined) ?? [],
    };
  };

  // Total Replies — informational card sitting next to Positive Replies; its
  // explainer shows the overall reply rate (total replies / emails sent).
  const totalReplyRate = stats.emailsSent > 0 ? (stats.totalReplies / stats.emailsSent) * 100 : 0;
  const totalRepliesCard: MetricCardVM = {
    label: "Total Replies",
    value: stats.totalReplies.toLocaleString("en-US"),
    subValue: stats.emailsSent > 0 ? `${totalReplyRate.toFixed(2)}% reply rate` : undefined,
    rangeText: null,
    status: "ON_TRACK",
    tips: [],
  };

  // 7 cards → 4 top row, 3 bottom (grid of 4). Total Replies next to Positive Replies.
  const cards: MetricCardVM[] = [
    configCard("EMAILS_SENT"),
    configCard("POSITIVE_REPLIES"),
    totalRepliesCard,
    configCard("QUALIFIED_APPTS"),
    configCard("POSITIVE_REPLY_RATE"),
    configCard("EMAILS_PER_BOOKED"),
    configCard("EMAILS_PER_QUALIFIED"),
  ];

  return (
    <>
      <div className="wa-page-head">
        <div>
          <h1 className="wa-page-title">Metrics</h1>
          <div className="wa-page-sub">
            Track campaign performance and key conversion metrics. Dates &amp; daily buckets shown in{" "}
            <b>{client.timezone.replace("_", " ")}</b> (matches Smartlead). Replies are counted on the
            day they arrived; sends on the day they went out.
          </div>
        </div>
        <div className="wa-page-controls">
          <AudienceFilter audiences={client.audiences.map((a) => ({ id: a.id, name: a.name }))} />
          <PeriodFilter />
        </div>
      </div>

      <div className="wa-kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {cards.map((c, i) => (
          <MetricCard key={i} {...c} />
        ))}
      </div>

      <ActivityChart data={stats.chartData} bounceRate={stats.bounceRate} />

      <div className="wa-card">
        <div className="wa-eyebrow">Appointments in {PERIOD_LABELS[selectedPeriod].toLowerCase()}</div>
        {periodAppts.length === 0 ? (
          <div className="wa-empty wa-empty-slim" style={{ marginTop: 10 }}>
            <p>No appointments fell within this time frame.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="wa-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Contact</th>
                  <th>Outcome</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {periodAppts.map((a, i) => (
                  <tr key={i}>
                    <td>{a.date}</td>
                    <td>{a.type}</td>
                    <td className="wa-table-name">{a.contactName}</td>
                    <td>
                      <span
                        className={`wa-status ${a.outcome === "Qualified" ? "wa-status-ok" : "wa-status-pend"}`}
                      >
                        {a.outcome}
                      </span>
                    </td>
                    <td className="wa-table-sub">{a.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
