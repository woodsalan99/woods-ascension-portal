import { getDashboardScope } from "@/lib/dashboard-scope";
import { prisma } from "@/lib/prisma";
import { formatCallDay } from "@/lib/format";

export default async function DocumentsPage() {
  const scope = await getDashboardScope();

  const docs = await prisma.document.findMany({
    where: { clientId: scope.clientId },
    orderBy: { docDate: "desc" },
    select: { id: true, name: true, note: true, docDate: true, contentType: true },
  });

  return (
    <>
      <div className="wa-page-head">
        <div>
          <h1 className="wa-page-title">Documents</h1>
          <div className="wa-page-sub">Invoices, contracts, and other official documents.</div>
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="wa-card">
          <div className="wa-empty wa-empty-slim">
            <p>No documents yet. Anything Woods Ascension shares with you will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="wa-card">
          <div className="wa-doc-list">
            {docs.map((d) => (
              <div key={d.id} className="wa-doc-row">
                <div className="wa-doc-main">
                  <div className="wa-doc-name">{d.name}</div>
                  <div className="wa-doc-date">{formatCallDay(d.docDate)}</div>
                  {d.note && <div className="wa-doc-note">{d.note}</div>}
                </div>
                <div className="wa-doc-actions">
                  <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="wa-doc-btn">
                    View
                  </a>
                  <a href={`/api/documents/${d.id}?download=1`} className="wa-doc-btn wa-doc-btn-ghost">
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
