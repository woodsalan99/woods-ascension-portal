import { Check } from "./icons";

export type MilestoneVM = {
  label: string;
  subLabel: string | null;
  state: "DONE" | "CURRENT" | "NEXT";
  progress: number | null; // 0..1, derived from currentValue/targetValue
};

export function Journey({ milestones }: { milestones: MilestoneVM[] }) {
  const doneCount = milestones.filter((m) => m.state === "DONE").length;
  const currentIdx = milestones.findIndex((m) => m.state === "CURRENT");
  const current = currentIdx >= 0 ? milestones[currentIdx] : undefined;
  const railPct =
    milestones.length > 1
      ? ((doneCount + (current?.progress ?? 0)) / (milestones.length - 1)) * 100
      : 0;

  return (
    <div className="wa-card">
      <div className="wa-section-head">
        <div>
          <div className="wa-eyebrow">Campaign journey</div>
          <h2 className="wa-h2">Where we are, and what&apos;s next</h2>
        </div>
        {current && (
          <div className="wa-focus-chip">
            <span className="wa-pulse" />
            Current focus: <b>{current.label}</b>
          </div>
        )}
      </div>

      <div className="wa-rail-wrap">
        <div className="wa-rail-line" />
        <div className="wa-rail-fill" style={{ width: `${Math.min(railPct, 100)}%` }} />
        <div
          className="wa-rail-nodes"
          style={{ ["--node-count" as string]: milestones.length }}
        >
          {milestones.map((m, i) => (
            <div key={i} className={`wa-node wa-node-${m.state.toLowerCase()}`}>
              <div className="wa-node-dot">
                {m.state === "DONE" && <Check />}
                {m.state === "CURRENT" && <span className="wa-node-ring" />}
              </div>
              <div className="wa-node-label">{m.label}</div>
              {m.subLabel && <div className="wa-node-sub">{m.subLabel}</div>}
            </div>
          ))}
        </div>
      </div>

      {current && current.progress !== null && (
        <div className="wa-progress-block">
          <div className="wa-progress-meta">
            <span>Progress to next milestone</span>
            <b>{Math.round(current.progress * 100)}%</b>
          </div>
          <div className="wa-progress-bar">
            <div className="wa-progress-fill" style={{ width: `${current.progress * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
