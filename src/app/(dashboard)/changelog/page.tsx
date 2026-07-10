import { getScopedContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ChangelogPage() {
  const ctx = await getScopedContext();
  if (!ctx.clientId) throw new Error("CLIENT user has no clientId assigned");

  const entries = await prisma.changelogEntry.findMany({
    where: { clientId: ctx.clientId },
    orderBy: { date: "desc" },
  });

  return (
    <>
      <div className="wa-page-head">
        <div>
          <h1 className="wa-page-title">Changelog</h1>
          <div className="wa-page-sub">
            This page is mainly for Woods Ascension internal tracking — clients can mostly ignore this.
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="wa-card">
          <div className="wa-empty wa-empty-slim">
            <p>Nothing logged yet.</p>
          </div>
        </div>
      ) : (
        <div className="wa-card">
          <div className="wa-ob-list">
            {entries.map((e) => (
              <div key={e.id} className="wa-ob-item">
                <div className="wa-ob-body">
                  <div className="wa-ob-step">{e.title}</div>
                  {e.body && <div className="wa-ob-day" style={{ marginTop: 4 }}>{e.body}</div>}
                </div>
                <span className="wa-ob-day">{e.date.toISOString().slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
