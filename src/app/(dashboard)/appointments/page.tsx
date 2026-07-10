import { getDashboardScope } from "@/lib/dashboard-scope";
import { getDashboardClient, type DashboardClient } from "@/lib/dashboard-data";
import { formatCallDay, formatDealValue } from "@/lib/format";
import { AudienceFilter } from "@/components/dashboard/AudienceFilter";
import { OutcomeSelect } from "@/components/dashboard/OutcomeSelect";
import { KPI } from "@/components/dashboard/KPI";
import { updateAppointmentOutcome } from "../actions";

type Entry = DashboardClient["pipeline"][number];

function deriveOutcome(callStatus: string | null, qualified: boolean): string {
  if (callStatus === "NO_SHOW") return "NO_SHOW";
  if (callStatus === "HELD") return qualified ? "QUALIFIED" : "NOT_QUALIFIED";
  return "PENDING";
}

function deriveStatusLabel(callDateTime: Date, callStatus: string | null): string {
  if (callStatus === "NO_SHOW") return "No-show";
  if (callStatus === "HELD") return "Completed";
  if (callDateTime > new Date()) return "Upcoming";
  return "Pending";
}

function AppointmentTable({ entries }: { entries: Entry[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="wa-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Contact</th>
            <th>Company</th>
            <th>Status</th>
            <th>Qualified?</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{formatCallDay(e.callDateTime!)}</td>
              <td className="wa-table-name">{e.contactName}</td>
              <td>
                {e.company}
                {e.dealValue && <div className="wa-table-sub">{formatDealValue(e.dealValue)}</div>}
              </td>
              <td>
                <span className={`wa-status ${e.callStatus === "HELD" ? "wa-status-ok" : "wa-status-pend"}`}>
                  {deriveStatusLabel(e.callDateTime!, e.callStatus)}
                </span>
              </td>
              <td>
                {e.callStatus === "HELD" || e.callStatus === "NO_SHOW"
                  ? e.qualified
                    ? "Yes"
                    : "No"
                  : "Pending"}
              </td>
              <td>
                <OutcomeSelect
                  entryId={e.id}
                  currentOutcome={deriveOutcome(e.callStatus, e.qualified)}
                  currentNotes={e.notes ?? ""}
                  action={updateAppointmentOutcome}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string }>;
}) {
  const { audience: audienceId } = await searchParams;
  const scope = await getDashboardScope();
  const client = await getDashboardClient(scope.clientId);

  const selectedAudienceId = audienceId && client.audiences.some((a) => a.id === audienceId) ? audienceId : null;
  const all = (selectedAudienceId
    ? client.pipeline.filter((p) => p.audienceId === selectedAudienceId)
    : client.pipeline
  ).filter((p) => p.callDateTime);

  const now = new Date();
  // Past = call date has passed OR it's already been held/no-showed.
  const isPast = (e: Entry) =>
    (e.callDateTime! < now && e.callStatus !== "CONFIRMED" && e.callStatus !== "PENDING") ||
    e.callStatus === "HELD" ||
    e.callStatus === "NO_SHOW";

  const upcoming = all.filter((e) => !isPast(e)).sort((a, b) => a.callDateTime!.getTime() - b.callDateTime!.getTime());
  const past = all.filter(isPast).sort((a, b) => b.callDateTime!.getTime() - a.callDateTime!.getTime());
  const qualifiedCount = all.filter((e) => e.callStatus === "HELD" && e.qualified).length;

  return (
    <>
      <div className="wa-page-head">
        <div>
          <h1 className="wa-page-title">Appointments</h1>
          <div className="wa-page-sub">View booked calls and outcomes.</div>
        </div>
        <div className="wa-page-controls">
          <AudienceFilter audiences={client.audiences.map((a) => ({ id: a.id, name: a.name }))} />
        </div>
      </div>

      <div className="wa-kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <KPI label="Upcoming appointments" value={upcoming.length} detail="Scheduled ahead" />
        <KPI label="Total appointments" value={all.length} detail="In selected range" />
        <KPI
          label="Qualified"
          value={qualifiedCount}
          detail={all.length > 0 ? `${Math.round((qualifiedCount / all.length) * 100)}% of total` : undefined}
          accent
        />
      </div>

      <div className="wa-card">
        <div className="wa-eyebrow">Upcoming</div>
        {upcoming.length === 0 ? (
          <div className="wa-empty wa-empty-slim" style={{ marginTop: 10 }}>
            <p>
              <b>No upcoming appointments.</b> New bookings will appear here.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <AppointmentTable entries={upcoming} />
          </div>
        )}
      </div>

      {past.length > 0 && (
        <details className="wa-card">
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>
            Past appointments ({past.length})
          </summary>
          <div style={{ marginTop: 12 }}>
            <AppointmentTable entries={past} />
          </div>
        </details>
      )}
    </>
  );
}
