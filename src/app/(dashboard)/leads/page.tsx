import { requireClientType } from "@/lib/dashboard-scope";

// Placeholder — the real 8-column kanban lands in Phase 3. See IMPLEMENTATION_STATE.md.
export default async function LeadsPage() {
  await requireClientType("LOCAL_SERVICES");

  return (
    <div className="wa-card">
      <div className="wa-eyebrow">Your leads</div>
      <h1 className="wa-page-title">Leads</h1>
      <p className="wa-page-sub">Coming soon — calls, form submissions, and Google leads will appear here.</p>
    </div>
  );
}
