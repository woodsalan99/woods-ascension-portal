"use client";

import { useState } from "react";
import { Check } from "./icons";

export type OnboardingStepVM = {
  label: string;
  dayLabel: string;
  state: "DONE" | "CURRENT" | "ACTIVE" | "NEXT";
  ctaLabel: string | null;
  ctaUrl: string | null;
};

export function Onboarding({ steps }: { steps: OnboardingStepVM[] }) {
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
          {steps.map((o, i) => {
            const stateClass = o.state.toLowerCase();
            return (
              <div key={i} className={`wa-ob-item wa-ob-${stateClass}`}>
                <div className="wa-ob-marker">
                  {o.state === "DONE" ? (
                    <Check color="#fff" />
                  ) : (
                    <span className="wa-ob-num">{i + 1}</span>
                  )}
                </div>
                <div className="wa-ob-body">
                  <div className="wa-ob-step">{o.label}</div>
                  <div className="wa-ob-day">{o.dayLabel}</div>
                </div>
                {o.state === "CURRENT" && o.ctaLabel && o.ctaUrl && (
                  <a className="wa-ob-cta" href={o.ctaUrl} target="_blank" rel="noopener noreferrer">
                    {o.ctaLabel} →
                  </a>
                )}
                {o.state === "CURRENT" && !o.ctaLabel && (
                  <span className="wa-ob-now">In progress</span>
                )}
                {o.state === "ACTIVE" && <span className="wa-ob-active">Underway</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
