import { KPI } from "./KPI";

export function KPIRow({
  isPreLaunch,
  domainsLive,
  inboxesWarming,
  warmupSends,
  daysToLaunch,
  emailsSent,
  positiveReplies,
  appointmentsBooked,
  pipelineValue,
}: {
  isPreLaunch: boolean;
  domainsLive: number;
  inboxesWarming: number;
  warmupSends: number;
  daysToLaunch: number | null;
  emailsSent: number;
  positiveReplies: number;
  appointmentsBooked: number;
  pipelineValue: number;
}) {
  if (isPreLaunch) {
    return (
      <div className="wa-kpis">
        <KPI label="Domains live" value={domainsLive} detail="Provisioned" />
        <KPI
          label="Inboxes warming"
          value={inboxesWarming}
          detail="On schedule for launch"
        />
        <KPI label="Warmup sends" value={warmupSends} detail="Protecting deliverability" />
        <KPI
          label="Days to launch"
          value={daysToLaunch ?? "—"}
          detail={daysToLaunch !== null ? "Launch date set" : "Launch date TBD"}
          accent
        />
      </div>
    );
  }

  return (
    <div className="wa-kpis">
      <KPI label="Emails sent" value={emailsSent} />
      <KPI label="Positive replies" value={positiveReplies} />
      <KPI label="Appointments booked" value={appointmentsBooked} />
      <KPI
        label="Pipeline value"
        value={Math.round(pipelineValue / 1000)}
        prefix="$"
        suffix="K"
        detail="Across booked & held appointments"
        accent
      />
    </div>
  );
}
