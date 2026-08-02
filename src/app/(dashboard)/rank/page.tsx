import { requireClientType } from "@/lib/dashboard-scope";

// Placeholder — geogrid/GSC rankings land in Phase 4. See IMPLEMENTATION_STATE.md.
export default async function RankPage() {
  await requireClientType("LOCAL_SERVICES");

  return (
    <div className="wa-card">
      <div className="wa-eyebrow">Google Maps</div>
      <h1 className="wa-page-title">Where you rank</h1>
      <p className="wa-page-sub">Coming soon — your monthly ranking checks will appear here.</p>
    </div>
  );
}
