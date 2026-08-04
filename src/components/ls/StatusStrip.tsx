import type { OverviewTrends, StatusState } from "@/lib/ls-trends";

// Three-second read at the top of the Overview, before anything else loads
// eyes: is the lead flow healthy, do reviews need attention, how many pages
// are showing. Each state is a plain rule in ls-trends.ts, not a threshold
// tuned to Canencia specifically — see the comment there before adding one.
const ICON: Record<StatusState, string> = { good: "✓", attention: "!", neutral: "•" };

function StatusItem({ state, title, detail }: { state: StatusState; title: string; detail: string }) {
  return (
    <div className={`wa-status-item ${state}`}>
      <span className="wa-status-icon">{ICON[state]}</span>
      <div>
        <div className="wa-status-title">{title}</div>
        <div className="wa-status-detail">{detail}</div>
      </div>
    </div>
  );
}

export function StatusStrip({
  trends,
  leadFlow,
  reviews,
  pages,
}: {
  trends: OverviewTrends;
  leadFlow: StatusState;
  reviews: StatusState;
  pages: StatusState;
}) {
  return (
    <div className="wa-status-strip">
      <StatusItem
        state={leadFlow}
        title={leadFlow === "good" ? "Lead flow healthy" : "No leads yet this window"}
        detail={`${trends.leads.current} real lead${trends.leads.current === 1 ? "" : "s"} in the last 30 days`}
      />
      <StatusItem
        state={reviews}
        title={reviews === "good" ? "Reviews growing" : reviews === "attention" ? "Reviews need attention" : "Reviews"}
        detail={
          trends.reviews.rating !== null
            ? `${trends.reviews.count} reviews · ${trends.reviews.rating.toFixed(1)} average`
            : "Not connected yet"
        }
      />
      <StatusItem
        state={pages}
        title={`${trends.pages.indexed} of ${trends.pages.total} pages indexed`}
        detail={
          trends.pages.total > 0
            ? `${Math.round((trends.pages.indexed / trends.pages.total) * 100)}% of town pages showing`
            : "No pages built yet"
        }
      />
    </div>
  );
}
