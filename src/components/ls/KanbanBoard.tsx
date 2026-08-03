"use client";

import { useState, useTransition } from "react";
import type { LeadStage, LeadSource } from "@prisma/client";
import { moveLeadStage, setJobWon, addLeadNote, toggleLeadBadFit, deleteLead } from "@/app/(dashboard)/leads/actions";
import { leadLabel, isPlaceholderLabel } from "@/lib/lead-label";

export type LeadCardVM = {
  id: string;
  stage: LeadStage;
  source: LeadSource;
  name: string | null;
  phone: string | null;
  email: string | null;
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
  history: LeadHistoryItem[];
};

export type LeadHistoryItem = {
  id: string;
  type: string; // CALL | MISSED_CALL | TEXT | FORM | LSA_REQUEST | STAGE_MOVE | NOTE | ...
  summary: string;
  occurredAt: Date;
};

const HISTORY_ICON: Record<string, string> = {
  CALL: "📞",
  MISSED_CALL: "📵",
  TEXT: "💬",
  FORM: "📝",
  LSA_REQUEST: "🅖",
  STAGE_MOVE: "→",
  NOTE: "🗒",
  VALUE_SET: "💵",
  QUALIFIED_TOGGLE: "✓",
  RENAME: "✎",
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

const STAGE_TITLE: Record<LeadStage, string> = Object.fromEntries(
  COLUMNS.map((c) => [c.stage, c.title]),
) as Record<LeadStage, string>;

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

// Client-side kanban. IMPORTANT: HTML5 drag-and-drop does not work on touch
// devices at all (iOS Safari / Chrome Android never fire dragstart from a
// finger), and Canencia's primary user is phone-first. So dragging is a
// DESKTOP CONVENIENCE ONLY — the real, always-available way to move a lead
// is to tap it and pick a stage in the detail sheet. Every action here must
// stay reachable without a mouse.
export function KanbanBoard({ leads: initialLeads }: { leads: LeadCardVM[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [pendingWon, setPendingWon] = useState<{ lead: LeadCardVM; returnToDetail: boolean } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LeadCardVM | null>(null);
  const [wonValue, setWonValue] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const openLead = leads.find((l) => l.id === openLeadId) ?? null;

  function applyStage(leadId: string, stage: LeadStage, jobValue?: number | null) {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage, jobValue: jobValue !== undefined ? jobValue : l.jobValue } : l)),
    );
  }

  // The single path every stage change goes through, whether it came from a
  // drag (desktop) or a tap on a stage button (any device).
  function changeStage(lead: LeadCardVM, stage: LeadStage, opts: { fromDetail?: boolean } = {}) {
    if (lead.stage === stage) return;

    if (stage === "JOB_WON") {
      setPendingWon({ lead, returnToDetail: !!opts.fromDetail });
      setWonValue(lead.jobValue !== null ? String(lead.jobValue) : "");
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

  function handleDrop(stage: LeadStage) {
    setDragOverStage(null);
    if (!dragId) return;
    const lead = leads.find((l) => l.id === dragId);
    setDragId(null);
    if (lead) changeStage(lead, stage);
  }

  function confirmJobWon() {
    if (!pendingWon) return;
    const value = parseFloat(wonValue.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(value) || value < 0) {
      setError("Enter the job price as a number, for example 5800.");
      return;
    }
    const { lead } = pendingWon;
    const prevStage = lead.stage;
    const prevValue = lead.jobValue;
    applyStage(lead.id, "JOB_WON", value);
    setPendingWon(null);
    startTransition(async () => {
      try {
        await setJobWon(lead.id, value);
      } catch (err) {
        applyStage(lead.id, prevStage, prevValue);
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function submitNote() {
    if (!openLead || !noteDraft.trim()) return;
    const leadId = openLead.id;
    const body = noteDraft;
    setNoteDraft("");
    setNoteSaved(true);
    startTransition(async () => {
      try {
        await addLeadNote(leadId, body);
      } catch (err) {
        setNoteSaved(false);
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleToggleBadFit(lead: LeadCardVM) {
    const prev = lead.qualified;
    const next = lead.qualified === false ? null : false;
    setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, qualified: next } : l)));
    startTransition(async () => {
      try {
        await toggleLeadBadFit(lead.id);
      } catch (err) {
        setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, qualified: prev } : l)));
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handleDelete(lead: LeadCardVM) {
    setPendingDelete(null);
    setOpenLeadId(null);
    setLeads((ls) => ls.filter((l) => l.id !== lead.id));
    startTransition(async () => {
      try {
        await deleteLead(lead.id);
      } catch (err) {
        setLeads((ls) => [...ls, lead]);
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function closeDetail() {
    setOpenLeadId(null);
    setNoteDraft("");
    setNoteSaved(false);
  }

  // No leads at all — 8 empty columns tell a non-technical reader nothing,
  // and on a phone they're just a long sideways scroll of nothing. Explain
  // what will happen instead.
  if (leads.length === 0) {
    return (
      <div className="wa-card">
        <div className="wa-empty">
          <div className="wa-empty-mark">◇</div>
          <p>
            <b>No leads yet — everything is switched on and watching.</b>
          </p>
          <p>
            When someone calls your tracked number, fills in the form on your website, or comes through your
            Google ad, they&apos;ll appear here on their own within a few minutes. You&apos;ll get a phone
            notification at the same time. Nothing for you to do until then.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div
          className="wa-modal-warn wa-modal-warn-error"
          style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
        >
          <span>{error}</span>
          <button className="wa-btn-ghost" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="wa-scroll-hint">Swipe sideways to see the other stages →</div>

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
                        role="button"
                        tabIndex={0}
                        aria-label={`Open ${leadLabel(lead)}`}
                        onClick={() => setOpenLeadId(lead.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpenLeadId(lead.id);
                          }
                        }}
                      >
                        <div className="wa-lead-top">
                          <div className={`wa-lead-name ${isPlaceholderLabel(lead) ? "wa-lead-name-unknown" : ""}`}>
                            {leadLabel(lead)}
                          </div>
                          {lead.jobValue !== null && (
                            <div className="wa-lead-value">${lead.jobValue.toLocaleString("en-US")}</div>
                          )}
                        </div>
                        <div className="wa-lead-context">
                          {[lead.serviceType, lead.location].filter(Boolean).join(" · ")}
                        </div>
                        {lead.message && <div className="wa-lead-quote">&ldquo;{lead.message}&rdquo;</div>}
                        <div className="wa-chip-row">
                          <span className={`wa-chip ${chip.cls}`}>{chip.label}</span>
                          {lead.qualified === false && <span className="wa-chip wa-chip-badfit">Bad fit</span>}
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
                        <div className="wa-lead-bottom">
                          <span className={due.cls}>{due.text}</span>
                          <span>{timeAgo(lead.receivedAt)}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Lead detail — the always-available way to do everything, on any
          device. Tapping a card opens this. */}
      {openLead && (
        <div className="wa-modal-bg" onClick={closeDetail}>
          <div className="wa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-head">
              <h2 className="wa-h2">{leadLabel(openLead)}</h2>
              <p className="wa-page-sub">
                {[SOURCE_CHIP[openLead.source].label, openLead.serviceType, openLead.location]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="wa-modal-body">
              {openLead.phone && (
                <p style={{ marginBottom: 14 }}>
                  <a className="wa-lead-call-link" href={`tel:${openLead.phone.replace(/[^0-9+]/g, "")}`}>
                    📞 Call {openLead.phone}
                  </a>
                </p>
              )}

              {openLead.message && <div className="wa-lead-quote" style={{ marginBottom: 16 }}>&ldquo;{openLead.message}&rdquo;</div>}

              {openLead.needsDetails && (
                <div className="wa-needs-detail" style={{ marginBottom: 16 }}>
                  <span>⚠</span>
                  <div>
                    Google hides this person&apos;s name and number until you reply to them in Google.{" "}
                    {openLead.callRailUrl && (
                      <a href={openLead.callRailUrl} target="_blank" rel="noopener noreferrer">
                        Open in Google →
                      </a>
                    )}
                  </div>
                </div>
              )}

              {openLead.callRecordId && (
                <div style={{ marginBottom: 16 }}>
                  <div className="wa-kpi-label" style={{ marginBottom: 6 }}>Listen to the call</div>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={`/api/callrail-recording/${openLead.callRecordId}`} style={{ width: "100%" }} />
                </div>
              )}

              {openLead.history.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="wa-kpi-label" style={{ marginBottom: 8 }}>
                    Everything that&apos;s happened with this lead
                  </div>
                  <div className="wa-history">
                    {openLead.history.map((h) => (
                      <div key={h.id} className="wa-history-item">
                        <span className="wa-history-icon">{HISTORY_ICON[h.type] ?? "•"}</span>
                        <div>
                          <div className="wa-history-summary">{h.summary}</div>
                          <div className="wa-history-when">
                            {h.occurredAt.toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="wa-kpi-label" style={{ marginBottom: 8 }}>Where is this lead now?</div>
              <div className="wa-stage-picker">
                {COLUMNS.map((col) => (
                  <button
                    key={col.stage}
                    type="button"
                    className={`wa-stage-btn ${openLead.stage === col.stage ? "is-current" : ""}`}
                    onClick={() => changeStage(openLead, col.stage, { fromDetail: true })}
                  >
                    {col.title}
                    {openLead.stage === col.stage && <span className="wa-stage-btn-tick"> ✓</span>}
                  </button>
                ))}
              </div>
              <p className="wa-page-sub" style={{ marginTop: 8 }}>
                Tap wherever this lead has got to. It saves straight away.
              </p>

              <label className="wa-lead-qualified-toggle" style={{ marginTop: 18 }}>
                <input
                  type="checkbox"
                  checked={openLead.qualified === false}
                  onChange={() => handleToggleBadFit(openLead)}
                />
                This wasn&apos;t a real lead — mark it as a bad fit
              </label>
              <p className="wa-page-sub" style={{ marginTop: 4 }}>
                Only tick this for the odd one that slips through. Bad-fit leads stop counting in your numbers.
              </p>

              <div className="wa-kpi-label" style={{ margin: "20px 0 8px" }}>Add a note</div>
              <textarea
                className="wa-edit-field wa-edit-field-multiline"
                placeholder="e.g. spoke to her Tuesday, she's deciding next week"
                value={noteDraft}
                onChange={(e) => {
                  setNoteDraft(e.target.value);
                  setNoteSaved(false);
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <button className="wa-btn-primary" disabled={!noteDraft.trim()} onClick={submitNote}>
                  Save note
                </button>
                {noteSaved && <span style={{ fontSize: 12.5, color: "var(--green)" }}>Saved ✓</span>}
              </div>
            </div>
            <div className="wa-modal-foot">
              <button className="wa-btn-danger" onClick={() => setPendingDelete(openLead)}>
                Delete this lead
              </button>
              <button className="wa-btn-primary" onClick={closeDetail}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="wa-modal-bg" onClick={() => setPendingDelete(null)}>
          <div className="wa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-head">
              <h2 className="wa-h2">Delete {leadLabel(pendingDelete)}?</h2>
              <p className="wa-page-sub">
                It disappears from the board and stops counting in your numbers. If this person ever gets in
                touch again, their card comes back with everything that&apos;s already on it.
              </p>
            </div>
            <div className="wa-modal-foot">
              <button className="wa-btn-ghost" onClick={() => setPendingDelete(null)}>
                Keep it
              </button>
              <button className="wa-btn-danger" onClick={() => handleDelete(pendingDelete)}>
                Delete it
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingWon && (
        <div className="wa-modal-bg" onClick={() => setPendingWon(null)}>
          <div className="wa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-head">
              <h2 className="wa-h2">What was the final job price?</h2>
              <p className="wa-page-sub">This is the only place we ever ask for it.</p>
            </div>
            <div className="wa-modal-body">
              <input
                className="wa-edit-field"
                placeholder="5800"
                inputMode="decimal"
                autoFocus
                value={wonValue}
                onChange={(e) => setWonValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmJobWon();
                }}
              />
              <p className="wa-page-sub" style={{ marginTop: 8 }}>
                Just the number — no dollar sign needed.
              </p>
            </div>
            <div className="wa-modal-foot">
              <button className="wa-btn-ghost" onClick={() => setPendingWon(null)}>
                Cancel
              </button>
              <button className="wa-btn-primary" onClick={confirmJobWon}>
                Save &amp; mark as won
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
