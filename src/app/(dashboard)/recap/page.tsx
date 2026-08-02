import { requireClientType } from "@/lib/dashboard-scope";

// Placeholder — the MonthlyWork-driven recap lands in Phase 5. See IMPLEMENTATION_STATE.md.
export default async function RecapPage() {
  await requireClientType("LOCAL_SERVICES");

  return (
    <>
      <div className="wa-page-head">
        <div>
          <div className="wa-eyebrow">Monthly recap</div>
          <h1 className="wa-page-title">Monthly recap</h1>
          <div className="wa-page-sub">What we did, what it produced, and what&apos;s coming next month.</div>
        </div>
      </div>
      <div className="wa-card">
        <div className="wa-empty">
          <div className="wa-empty-mark">◇</div>
          <p>
            <b>Your first recap arrives at the end of the month.</b>
          </p>
          <p>
            One short page each month: the headline of what actually happened, the numbers that go with it, and
            what&apos;s planned next — so you never have to wonder what you&apos;re paying for.
          </p>
        </div>
      </div>
    </>
  );
}
