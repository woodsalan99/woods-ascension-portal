export type AppointmentVM = {
  when: string;
  contactName: string;
  company: string;
  topic: string;
  status: "CONFIRMED" | "PENDING" | "HELD" | "NO_SHOW" | string;
};

export function Appointments({
  appointments,
  isPreLaunch,
}: {
  appointments: AppointmentVM[];
  isPreLaunch: boolean;
}) {
  return (
    <div className="wa-card">
      <div className="wa-section-head">
        <div>
          <div className="wa-eyebrow">Appointments</div>
          <h2 className="wa-h2">Upcoming booked appointments</h2>
        </div>
      </div>
      {appointments.length === 0 ? (
        <div className="wa-empty wa-empty-slim">
          <p>
            <b>No appointments yet — exactly as planned.</b>{" "}
            {isPreLaunch
              ? "First booked appointments typically land in the weeks after launch. They'll appear here with contact details, deal context, and confirmation status."
              : "New bookings will appear here with contact details, deal context, and confirmation status."}
          </p>
        </div>
      ) : (
        <div className="wa-calls">
          {appointments.map((c, i) => (
            <div key={i} className="wa-call-row">
              <div className="wa-call-when">{c.when}</div>
              <div className="wa-call-who">
                <div className="wa-lead-name">{c.contactName}</div>
                <div className="wa-lead-co">{c.company}</div>
              </div>
              <div className="wa-call-topic">{c.topic}</div>
              <span
                className={`wa-status ${c.status === "CONFIRMED" || c.status === "HELD" ? "wa-status-ok" : "wa-status-pend"}`}
              >
                {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
