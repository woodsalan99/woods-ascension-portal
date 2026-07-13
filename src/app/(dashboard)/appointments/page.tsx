import { getDashboardScope } from "@/lib/dashboard-scope";
import { getDashboardClient, type DashboardClient } from "@/lib/dashboard-data";
import { formatCallDay, formatDealValue } from "@/lib/format";
import { AudienceFilter } from "@/components/dashboard/AudienceFilter";
import { OutcomeSelect } from "@/components/dashboard/OutcomeSelect";
import { KPI } from "@/components/dashboard/KPI";
import { updateAppointmentOutcome, addAppointment } from "../actions";

type Entry = DashboardClient["pipeline"][number];

function deriveOutcome(callStatus: string | null, qualified: boolean): string {
  if (callStatus === "NO_SHOW") return "NO_SHOW";
  if (callStatus === "HELD") return qualified ? "QUALIFIED" : "NOT_QUALIFIED";
  return "PENDING";
}

// Call dates are stored date-only (UTC midnight), so compare by calendar
// day, not exact timestamp — otherwise a same-day appointment reads as
// "Pending" (already past) for nearly the entire day. Matches the
// todayStart convention used for the upcoming/past split below.
function deriveStatusLabel(callDateTime: Date, callStatus: string | null): string {
  if (callStatus === "NO_SHOW") return "No-show";
  if (callStatus === "HELD") return "Completed";
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  return callDateTime >= todayStart ? "Upcoming" : "Pending";
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

  // "Upcoming" = the call is today or in the future AND hasn't happened yet.
  // Anything already held/no-showed, or dated before today, is Past —
  // regardless of its confirmed/pending status.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const isPast = (e: Entry) =>
    e.callStatus === "HELD" || e.callStatus === "NO_SHOW" || e.callDateTime! < todayStart;

  const upcoming = all.filter((e) => !isPast(e)).sort((a, b) => a.callDateTime!.getTime() - b.callDateTime!.getTime());
  const past = all.filter(isPast).sort((a, b) => b.callDateTime!.getTime() - a.callDateTime!.getTime());
  // "Qualified" is judged against appointments that have actually occurred
  // (held or no-showed) — not against everything booked, since upcoming
  // appointments don't have an outcome yet.
  const occurred = all.filter((e) => e.callStatus === "HELD" || e.callStatus === "NO_SHOW");
  const qualifiedCount = occurred.filter((e) => e.qualified).length;

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
          detail={
            occurred.length > 0
              ? `${Math.round((qualifiedCount / occurred.length) * 100)}% of appointments that have occurred`
              : undefined
          }
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

      <div className="wa-card">
        <div className="wa-eyebrow">Add an appointment</div>
        <div className="wa-page-sub" style={{ marginTop: 2, marginBottom: 10 }}>
          See anything missing? Log a call here and it&apos;ll appear below for easy tracking.
        </div>
        <form
          action={async (formData: FormData) => {
            "use server";
            await addAppointment(formData);
          }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}
        >
          <label style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Contact name
            <input name="contactName" required className="wa-select" style={{ display: "block", marginTop: 4, width: 160 }} />
          </label>
          <label style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Company
            <input name="company" className="wa-select" style={{ display: "block", marginTop: 4, width: 160 }} />
          </label>
          <label style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Email
            <input name="email" type="email" className="wa-select" style={{ display: "block", marginTop: 4, width: 180 }} />
          </label>
          <label style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Type
            <select name="type" className="wa-select" style={{ display: "block", marginTop: 4 }}>
              <option value="DISCOVERY">Discovery</option>
              <option value="SALES">Sales</option>
            </select>
          </label>
          <label style={{ fontSize: 12.5, color: "var(--muted)" }}>
            Date
            <input name="date" type="date" required className="wa-select" style={{ display: "block", marginTop: 4 }} />
          </label>
          <button type="submit" className="wa-ob-cta" style={{ fontSize: 12.5, padding: "8px 16px" }}>
            Add appointment
          </button>
        </form>
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
