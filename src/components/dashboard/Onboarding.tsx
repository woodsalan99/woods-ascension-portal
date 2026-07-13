"use client";

import { useState, useTransition } from "react";
import { Check } from "./icons";

export type OnboardingStepVM = {
  id: string;
  label: string;
  description: string | null;
  dayLabel: string;
  state: "DONE" | "CURRENT" | "ACTIVE" | "NEXT";
  ctaLabel: string | null;
  ctaUrl: string | null;
  clientActionable: boolean;
};

export function Onboarding({
  steps,
  onComplete,
}: {
  steps: OnboardingStepVM[];
  onComplete?: (stepId: string) => Promise<void>;
}) {
  const doneCount = steps.filter((s) => s.state === "DONE").length;
  const allDone = steps.length > 0 && doneCount === steps.length;
  const [open, setOpen] = useState(!allDone);

  return (
    <div className="wa-card">
      <button className="wa-ob-head" onClick={() => setOpen(!open)}>
        <div>
          <div className="wa-eyebrow">Onboarding</div>
          <h2 className="wa-h2">
            {allDone ? "Onboarding — complete" : "Getting you launched"}
          </h2>
        </div>
        <div className="wa-ob-right">
          {allDone ? (
            <span className="wa-badge-done">
              <Check size={10} /> {steps.length} of {steps.length} complete
            </span>
          ) : (
            <span className="wa-badge-live">
              {doneCount} of {steps.length} complete
            </span>
          )}
          <span className={`wa-chevron ${open ? "wa-chevron-open" : ""}`}>▾</span>
        </div>
      </button>

      {open && (
        <div className="wa-ob-list">
          {steps.map((o, i) => (
            <OnboardingRow key={o.id} step={o} index={i} onComplete={onComplete} />
          ))}
        </div>
      )}
    </div>
  );
}

function OnboardingRow({
  step: o,
  index: i,
  onComplete,
}: {
  step: OnboardingStepVM;
  index: number;
  onComplete?: (stepId: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const stateClass = o.state.toLowerCase();
  const hasDescription = !!o.description;

  return (
    <div className={`wa-ob-card wa-ob-${stateClass}`}>
      <div
        className="wa-ob-item"
        style={hasDescription ? { cursor: "pointer" } : undefined}
        onClick={hasDescription ? () => setExpanded((e) => !e) : undefined}
      >
        <div className="wa-ob-marker">
          {o.state === "DONE" ? <Check color="#fff" /> : <span className="wa-ob-num">{i + 1}</span>}
        </div>
        <div className="wa-ob-body">
          <div className="wa-ob-step">{o.label}</div>
          <div className="wa-ob-day">{o.dayLabel}</div>
        </div>
        {o.state === "CURRENT" && o.clientActionable && onComplete && (
          <button
            className="wa-ob-cta"
            disabled={isPending}
            onClick={(e) => {
              e.stopPropagation();
              startTransition(() => onComplete(o.id));
            }}
          >
            {isPending ? "Completing…" : "Mark complete →"}
          </button>
        )}
        {o.state === "CURRENT" && !o.clientActionable && o.ctaLabel && o.ctaUrl && (
          <a
            className="wa-ob-cta"
            href={o.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {o.ctaLabel} →
          </a>
        )}
        {o.state === "CURRENT" && !o.clientActionable && !o.ctaLabel && (
          <span className="wa-ob-now">In progress</span>
        )}
        {o.state === "ACTIVE" && <span className="wa-ob-active">Underway</span>}
        {hasDescription && <span className={`wa-chevron ${expanded ? "wa-chevron-open" : ""}`}>▾</span>}
      </div>
      {hasDescription && expanded && <div className="wa-ob-desc">{o.description}</div>}
    </div>
  );
}
