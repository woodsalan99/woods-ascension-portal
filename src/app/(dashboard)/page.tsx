import { getDashboardScope } from "@/lib/dashboard-scope";
import { getDashboardClient } from "@/lib/dashboard-data";
import {
  computeActivityStats,
  computeAppointments,
  computeClientActionItems,
  computeLaunchState,
  computeMilestones,
} from "@/lib/dashboard-compute";
import { KPI } from "@/components/dashboard/KPI";
import { Journey } from "@/components/dashboard/Journey";
import { Appointments } from "@/components/dashboard/Appointments";
import { AlanNote } from "@/components/dashboard/AlanNote";

export default async function OverviewPage() {
  const scope = await getDashboardScope();
  const client = await getDashboardClient(scope.clientId);

  const { isPreLaunch, daysToLaunch, daySinceStart } = computeLaunchState(client);
  const stats = computeActivityStats(client, null);
  const milestones = computeMilestones(client);
  const appointments = computeAppointments(client, null, 3);
  const actionItems = computeClientActionItems(client);
  const note = client.notes[0];

  return (
    <>
      {client.welcomeTitle && (
        <div className="wa-welcome">
          <div className="wa-welcome-title">{client.welcomeTitle}</div>
          {client.welcomeMessage && <div className="wa-welcome-message">{client.welcomeMessage}</div>}
        </div>
      )}

      <div className="wa-page-head">
        <div>
          <h1 className="wa-page-title">
            {isPreLaunch ? (
              <>
                Groundwork phase. Every quiet day here is <em>deliberate</em>.
              </>
            ) : (
              <>
                {stats.appointmentsBooked} appointment{stats.appointmentsBooked === 1 ? "" : "s"} booked.
                The next milestone is <em>close</em>.
              </>
            )}
          </h1>
        </div>
        <span className="wa-weekbadge">Day {daySinceStart}</span>
      </div>

      <div className="wa-kpis">
        {isPreLaunch ? (
          <>
            <KPI label="Domains live" value={client.domainsLive ?? 0} detail="Provisioned" />
            <KPI label="Inboxes warming" value={client.inboxesWarming ?? 0} detail="On schedule for launch" />
            <KPI label="Days to launch" value={daysToLaunch ?? "—"} detail={daysToLaunch !== null ? "Launch date set" : "Launch date TBD"} accent />
          </>
        ) : (
          <>
            <KPI label="Emails sent" value={stats.emailsSent} />
            <KPI label="Positive replies" value={stats.positiveReplies} />
            <KPI label="Qualified appointments" value={stats.qualifiedCount} accent />
          </>
        )}
      </div>

      <Journey milestones={milestones} />

      <Appointments appointments={appointments} isPreLaunch={isPreLaunch} />

      {actionItems.length > 0 && (
        <div className="wa-card">
          <div className="wa-eyebrow">Client action items</div>
          <div className="wa-ob-list">
            {actionItems.map((item, i) => (
              <a key={i} href={item.href} className="wa-ob-item" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="wa-ob-body">
                  <div className="wa-ob-step">{item.label}</div>
                </div>
                <span className="wa-ob-now">{item.status} →</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {note && <AlanNote headline={note.headline} body={note.body} videoUrl={note.videoUrl} />}
    </>
  );
}
