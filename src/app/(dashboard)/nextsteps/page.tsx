import { requireClientType } from "@/lib/dashboard-scope";

// Placeholder — real tasks/submissions land in Phase 5. See IMPLEMENTATION_STATE.md.
export default async function NextStepsPage() {
  await requireClientType("LOCAL_SERVICES");

  return (
    <div className="wa-card">
      <div className="wa-eyebrow">Your side of it</div>
      <h1 className="wa-page-title">What I need from you</h1>
      <p className="wa-page-sub">Coming soon — specific things you can act on will appear here.</p>
    </div>
  );
}
