"use client";

import { useState, useTransition } from "react";
import type { LeadStage, LeadSource } from "@prisma/client";
import { moveLeadStage, setJobWon, addLeadNote, toggleLeadQualified } from "@/app/(dashboard)/leads/actions";

export type LeadCardVM = {
  id: string;
  stage: LeadStage;
  source: LeadSource;
  name: string | null;
  location: string | null;
  serviceType: string | null;
  message: string | null;
  qualified: boolean | null;
  needsDetails: boolean;
  jobValue: number | null;
  callRecordId: string | null;
  callRailUrl: string | null;
  nextActionLabel: string | null;
  nextActionAt: Date | null;
  receivedAt: Date;
};

const COLUMNS: { stage: LeadStage; title: string; help: string }[] = [
  { stage: "NEW", title: "New Lead", help: "Call or text within five minutes." },
  { stage: "CONTACTED", title: "Contacted", help: "You've spoken; estimate not booked yet." },
  { stage: "QUOTE_SENT", title: "Quote Sent", help: "Waiting to hear back. Follow up." },
  { stage: "JOB_SCHEDULED", title: "Job Scheduled", help: "They said yes. Start date is set." },
  { stage: "JOB_WON", title: "Job Won", help: "Put the final job price here — it's the only spot we ask for it." },
  { stage: "REVIEW_REQUESTED", title: "Review Requested", help: "We've asked them. One reminder follows." },
  { stage: "REVIEW_COMPLETE", title: "Review Left", help: "They left a Google review. All done." },
  { stage: "LOST", title: "Lost / Went Cold", help: "Stopped replying or chose someone else." },
];

const SOURCE_CHIP: Record<LeadSource, { label: string; cls: string }> = {
  LSA: { label: "Google Ads", cls: "wa-chip-lsa" },
  GBP_CALL: { label: "Google Maps", cls: "wa-chip-maps" },
  WEBSITE_FORM: { label: "Website form", cls: "wa-chip-web" },
  REFERRAL: { label: "Referral", cls: "wa-chip-ref" },
  OTHER: { label: "Other", cls: "" },
};

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function dueLabel(date: Date | null): { text: string; cls: string } {
  if (!date) return { text: "No date", cls: "" };
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const fmt = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (date < todayStart) return { text: `Overdue · ${fmt}`, cls: "wa-due-over" };
  if (date < tomorrowStart) return { text: "Today", cls: "wa-due-today" };
  return { text: fmt, cls: "" };
}

// Client-side kanban: drag-and-drop reorders instantly (optimistic), each
// mutation is a targeted server action, and a failed action reverts the
// optimistic change with an inline error rather than leaving the UI lying.
// Drop onto Job Won is intercepted by a required-value modal — jobValue is
// asked ONLY here, matching the handoff's do-not list.
export function KanbanBoard({ leads: initialLeads }: { leads: LeadCardVM[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [pendingWon, setPendingWon] = useState<LeadCardVM | null>(null);
  const [wonValue, setWonValue] = useState("");
  const [notesFor, setNotesFor] = useState<LeadCardVM | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function applyStage(leadId: string, stage: LeadStage, jobValue?: number | null) {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage, jobValue: jobValue !== undefined ? jobValue : l.jobValue } : l)));
  }

  function handleDrop(stage: LeadStage) {
    setDragOverStage(null);
    if (!dragId) return;
    const lead = leads.find((l) => l.id === dragId);
    setDragId(null);
    if (!lead || lead.stage === stage) return;

    if (stage === "JOB_WON") {
      setPendingWon(lead);
      setWonValue("");
      return;
    }

    const prevStage = lead.stage;
    applyStage(lead.id, stage);
    startTransition(async () => {
      try {
        await moveLeadStage(lead.id, stage);
      } catch (err) {
        applyStage(lead.id, prevStage);
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function confirmJobWon() {
    if (!pendingWon) return;
    const value = parseFloat(wonValue.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(value) || value < 0) {
      setError("Enter a valid job value.");
      return;
    }
    const lead = pendingWon;
    const prevStage = lead.stage;
    applyStage(lead.id, "JOB_WON", value);
    setPendingWon(null);
    startTransition(async () => {
      try {
        await setJobWon(lead.id, value);
      } catch (err) {
        applyStage(lead.id, prevStage, lead.jobValue);
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function submitNote() {
    if (!notesFor || !noteDraft.trim()) return;
    const leadId = notesFor.id;
    const body = noteDraft;
    setNoteDraft("");
    setNotesFor(null);
    startTransition(async () => {
      try {
        await addLeadNote(leadId, body);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleToggleQualified(lead: LeadCardVM) {
    const prev = lead.qualified;
    const next = lead.qualified !== true;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, qualified: next } : l)));
    startTransition(async () => {
      try {
        await toggleLeadQualified(lead.id);
      } catch (err) {
        setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, qualified: prev } : l)));
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <>
      {error && (
        <div className="wa-modal-warn wa-modal-warn-error" style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button className="wa-btn-ghost" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="wa-kanban-wrap">
        <div className="wa-kanban">
          {COLUMNS.map((col) => {
            const colLeads = leads.filter((l) => l.stage === col.stage);
            const colValue = colLeads.reduce((sum, l) => sum + (l.jobValue ?? 0), 0);
            return (
              <section
                key={col.stage}
                className={`wa-kcol ${dragOverStage === col.stage ? "wa-kcol-drag-over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStage(col.stage);
                }}
                onDragLeave={() => setDragOverStage((s) => (s === col.stage ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(col.stage);
                }}
              >
                <div className="wa-kcol-head">
                  <div className="wa-kcol-title">{col.title}</div>
                  <span className="wa-kcount">{colLeads.length}</span>
                </div>
                {col.stage === "JOB_WON" && colValue > 0 && (
                  <div className="wa-kcol-value">${colValue.toLocaleString("en-US")} won</div>
                )}
                <div className="wa-kcol-help">{col.help}</div>
                <div className="wa-klist">
                  {colLeads.map((lead) => {
                    const chip = SOURCE_CHIP[lead.source];
                    const due = dueLabel(lead.nextActionAt);
                    return (
                      <article
                        key={lead.id}
                        className="wa-lead-card"
                        draggable
                        onDragStart={() => setDragId(lead.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setNotesFor(lead)}
                      >
                        <div className="wa-lead-top">
                          <div className={`wa-lead-name ${!lead.name ? "wa-lead-name-unknown" : ""}`}>
                            {lead.name ?? "Name hidden by Google"}
                          </div>
                          {lead.jobValue !== null && <div className="wa-lead-value">${lead.jobValue.toLocaleString("en-US")}</div>}
                        </div>
                        <div className="wa-lead-context">{[lead.serviceType, lead.location].filter(Boolean).join(" · ")}</div>
                        {lead.message && <div className="wa-lead-quote">&ldquo;{lead.message}&rdquo;</div>}
                        <div className="wa-chip-row">
                          <span className={`wa-chip ${chip.cls}`}>{chip.label}</span>
                          {lead.qualified === true && <span className="wa-chip wa-chip-qualified">Qualified</span>}
                        </div>
                        {lead.nextActionLabel && <div className="wa-lead-action">{lead.nextActionLabel}</div>}
                        {lead.needsDetails && (
                          <div className="wa-needs-detail">
                            <span>⚠</span>
                            <div>
                              Google hides the name and number until you reply.{" "}
                              {lead.callRailUrl && (
                                <a
                                  href={lead.callRailUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Open in Google →
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                        {lead.callRecordId && (
                          <div className="wa-lead-links" onClick={(e) => e.stopPropagation()}>
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            <audio controls src={`/api/callrail-recording/${lead.callRecordId}`} style={{ width: "100%", height: 32 }} />
                          </div>
                        )}
                        <div className="wa-lead-bottom">
                          <span className={due.cls}>{due.text}</span>
                          <span>{timeAgo(lead.receivedAt)}</span>
                        </div>
                        <label className="wa-lead-qualified-toggle" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={lead.qualified === true} onChange={() => handleToggleQualified(lead)} />
                          Qualified
                        </label>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {pendingWon && (
        <div className="wa-modal-bg" onClick={() => setPendingWon(null)}>
          <div className="wa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-head">
              <h2 className="wa-h2">What was the final job price?</h2>
              <p className="wa-page-sub">This is the only place we ask for it.</p>
            </div>
            <div className="wa-modal-body">
              <input
                className="wa-edit-field"
                placeholder="$0"
                autoFocus
                value={wonValue}
                onChange={(e) => setWonValue(e.target.value)}
              />
            </div>
            <div className="wa-modal-foot">
              <button className="wa-btn-ghost" onClick={() => setPendingWon(null)}>
                Cancel
              </button>
              <button className="wa-btn-primary" onClick={confirmJobWon}>
                Save &amp; move to Job Won
              </button>
            </div>
          </div>
        </div>
      )}

      {notesFor && (
        <div className="wa-modal-bg" onClick={() => setNotesFor(null)}>
          <div className="wa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-head">
              <h2 className="wa-h2">{notesFor.name ?? "Name hidden by Google"}</h2>
              <p className="wa-page-sub">Add a note about this lead.</p>
            </div>
            <div className="wa-modal-body">
              <textarea
                className="wa-edit-field wa-edit-field-multiline"
                placeholder="e.g. spoke to her Tuesday, she's deciding next week"
                autoFocus
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
            </div>
            <div className="wa-modal-foot">
              <button className="wa-btn-ghost" onClick={() => setNotesFor(null)}>
                Close
              </button>
              <button className="wa-btn-primary" disabled={!noteDraft.trim()} onClick={submitNote}>
                Save note
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
