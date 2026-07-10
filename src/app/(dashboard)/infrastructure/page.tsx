import { getDashboardScope } from "@/lib/dashboard-scope";
import { getDashboardClient } from "@/lib/dashboard-data";

const WHAT_THIS_COVERS = [
  "Sending infrastructure",
  "Inbox setup & warming",
  "Lead sourcing & verification",
  "Tracking and routing setup",
];

export default async function InfrastructurePage() {
  const scope = await getDashboardScope();
  const client = await getDashboardClient(scope.clientId);

  const total = client.infrastructure.reduce((sum, i) => sum + i.monthlyCost, 0);

  return (
    <>
      <div className="wa-page-head">
        <div>
          <h1 className="wa-page-title">Infrastructure</h1>
          <div className="wa-page-sub">See what has been deployed for your campaign and where the investment is going.</div>
        </div>
        <span className="wa-badge-done">● {client.status === "ACTIVE" ? "Active" : client.status}</span>
      </div>

      {client.infrastructure.length === 0 ? (
        <div className="wa-card">
          <div className="wa-empty">
            <p>
              <b>Infrastructure details appear here once provisioning begins.</b>
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="wa-card">
            <div style={{ overflowX: "auto" }}>
              <table className="wa-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Monthly cost</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {client.infrastructure.map((item) => (
                    <tr key={item.id}>
                      <td className="wa-table-name">{item.label}</td>
                      <td>{item.quantity.toLocaleString("en-US")}</td>
                      <td>
                        <span className="wa-badge-done">{item.status}</span>
                      </td>
                      <td>${item.monthlyCost.toLocaleString("en-US")}</td>
                      <td className="wa-table-sub">{item.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, textAlign: "right", fontSize: 13.5 }}>
              Monthly infrastructure total{" "}
              <b style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: "var(--green)", marginLeft: 6 }}>
                ${total.toLocaleString("en-US")}
              </b>
            </div>
          </div>

          <div className="wa-note-row">
            <div className="wa-card">
              <div className="wa-eyebrow">What this covers</div>
              <ul style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5 }}>
                {WHAT_THIS_COVERS.map((item) => (
                  <li key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--green)" }}>✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="wa-card">
              <div className="wa-eyebrow">Note from Alan</div>
              <p className="wa-note-p" style={{ marginTop: 8 }}>
                Everything here supports reliable sending and clean execution. The goal is not just
                to launch fast, but to launch with the right infrastructure behind it so performance
                stays stable as volume grows.
              </p>
              <div className="wa-note-sig">— Alan · Woods Ascension</div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
