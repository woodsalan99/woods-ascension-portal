import { requireClientType } from "@/lib/dashboard-scope";

// Placeholder — the resolver-driven Numbers page lands in Phase 4. See IMPLEMENTATION_STATE.md.
export default async function NumbersPage() {
  await requireClientType("LOCAL_SERVICES");

  return (
    <>
      <div className="wa-page-head">
        <div>
          <div className="wa-eyebrow">The numbers</div>
          <h1 className="wa-page-title">The numbers</h1>
          <div className="wa-page-sub">
            Everything worth watching, in plain English — with a note under each one saying what&apos;s
            realistic for a painter here, not a national average from a much bigger city.
          </div>
        </div>
      </div>
      <div className="wa-card">
        <div className="wa-empty">
          <div className="wa-empty-mark">◇</div>
          <p>
            <b>This fills in as the first full month of data comes through.</b>
          </p>
          <p>
            You&apos;ll see what your Google ads are doing, what each lead actually costs, where your customers
            came from, and how your reviews are tracking — each with a plain-English explanation of whether
            that number is healthy.
          </p>
        </div>
      </div>
    </>
  );
}
