import { requireClientType } from "@/lib/dashboard-scope";

// Placeholder — geogrid/GSC rankings land in Phase 4. See IMPLEMENTATION_STATE.md.
export default async function RankPage() {
  await requireClientType("LOCAL_SERVICES");

  return (
    <>
      <div className="wa-page-head">
        <div>
          <div className="wa-eyebrow">Google Maps</div>
          <h1 className="wa-page-title">Where you rank</h1>
          <div className="wa-page-sub">
            Every month we check what position you come up in when someone searches from different spots around
            the island.
          </div>
        </div>
      </div>
      <div className="wa-card">
        <div className="wa-empty">
          <div className="wa-empty-mark">◇</div>
          <p>
            <b>Your first ranking check is being prepared.</b>
          </p>
          <p>
            Once it&apos;s run, this page will show a map of the island with your position at each spot, how
            that average is moving month to month, and which areas you&apos;re strongest and weakest in.
          </p>
        </div>
      </div>
    </>
  );
}
