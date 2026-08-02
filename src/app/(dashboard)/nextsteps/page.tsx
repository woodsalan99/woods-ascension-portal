import { requireClientType } from "@/lib/dashboard-scope";

// Placeholder — real tasks/submissions land in Phase 5. See IMPLEMENTATION_STATE.md.
export default async function NextStepsPage() {
  await requireClientType("LOCAL_SERVICES");

  return (
    <>
      <div className="wa-page-head">
        <div>
          <div className="wa-eyebrow">Your side of it</div>
          <h1 className="wa-page-title">What I need from you</h1>
          <div className="wa-page-sub">
            Everything I need on your end, in one place — so you never have to dig through texts or emails to
            find it.
          </div>
        </div>
      </div>
      <div className="wa-card">
        <div className="wa-empty">
          <div className="wa-empty-mark">◇</div>
          <p>
            <b>Nothing needed from you right now.</b>
          </p>
          <p>
            When there&apos;s something that would genuinely move things forward — customer names for review
            requests, photos from a finished job, a follow-up worth chasing — it&apos;ll show up here, and
            you&apos;ll be able to reply or upload straight into the page.
          </p>
        </div>
      </div>
    </>
  );
}
