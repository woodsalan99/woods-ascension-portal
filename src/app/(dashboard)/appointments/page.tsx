import { getScopedContext } from "@/lib/auth";
import { getDashboardClient } from "@/lib/dashboard-data";
import { formatCallWhen, formatDealValue } from "@/lib/format";
import { AudienceFilter } from "@/components/dashboard/AudienceFilter";
import { OutcomeSelect } from "@/components/dashboard/OutcomeSelect";
import { KPI } from "@/components/dashboard/KPI";
import { updateAppointmentOutcome } from "../actions";

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

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string }>;
}) {
  const { audience: audienceId } = await searchParams;
  const ctx = await getScopedContext();
  if (!ctx.clientId) throw new Error("CLIENT user has no clientId assigned");
  const client = await getDashboardClient(ctx.clientId);

  const selectedAudienceId = audienceId && client.audiences.some((a) => a.id === audienceId) ? audienceId : null;
  const entries = (selectedAudienceId
    ? client.pipeline.filter((p) => p.audienceId === selectedAudienceId)
    : client.pipeline
  )
    .filter((p) => p.callDateTime)
    .sort((a, b) => b.callDateTime!.getTime() - a.callDateTime!.getTime());

  const now = new Date();
  const upcomingCount = entries.filter((e) => e.callDateTime! > now).length;
  const qualifiedCount = entries.filter((e) => e.callStatus === "HELD" && e.qualified).length;

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
        <KPI label="Upcoming appointments" value={upcomingCount} detail="Next 7 days" />
        <KPI label="Total appointments" value={entries.length} detail="In selected range" />
        <KPI
          label="Qualified"
          value={qualifiedCount}
          detail={entries.length > 0 ? `${Math.round((qualifiedCount / entries.length) * 100)}% of total` : undefined}
          accent
        />
      </div>

      <div className="wa-card">
        {entries.length === 0 ? (
          <div className="wa-empty wa-empty-slim">
            <p>
              <b>No appointments yet.</b> They&apos;ll appear here once booked.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="wa-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
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
                    <td>{formatCallWhen(e.callDateTime!, client.timezone)}</td>
                    <td className="wa-table-name">{e.contactName}</td>
                    <td>
                      {e.company}
                      {e.dealValue && <div className="wa-table-sub">{formatDealValue(e.dealValue)}</div>}
                    </td>
                    <td>
                      <span
                        className={`wa-status ${e.callStatus === "HELD" ? "wa-status-ok" : "wa-status-pend"}`}
                      >
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
        )}
      </div>
    </>
  );
}
