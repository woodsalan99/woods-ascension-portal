import { requireClientType } from "@/lib/dashboard-scope";

// Placeholder — the resolver-driven Numbers page lands in Phase 4. See IMPLEMENTATION_STATE.md.
export default async function NumbersPage() {
  await requireClientType("LOCAL_SERVICES");

  return (
    <div className="wa-card">
      <div className="wa-eyebrow">The numbers</div>
      <h1 className="wa-page-title">The numbers</h1>
      <p className="wa-page-sub">Coming soon — your ad performance and customer numbers will appear here.</p>
    </div>
  );
}
