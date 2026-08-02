import { requireClientType } from "@/lib/dashboard-scope";

// Placeholder — the MonthlyWork-driven recap lands in Phase 5. See IMPLEMENTATION_STATE.md.
export default async function RecapPage() {
  await requireClientType("LOCAL_SERVICES");

  return (
    <div className="wa-card">
      <div className="wa-eyebrow">Monthly recap</div>
      <h1 className="wa-page-title">Monthly recap</h1>
      <p className="wa-page-sub">Coming soon — what we did and what&apos;s next will appear here each month.</p>
    </div>
  );
}
