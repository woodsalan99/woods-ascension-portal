"use client";

import { useRef, useState } from "react";
import { renameLead, addLeadNote } from "@/app/(dashboard)/leads/actions";
import { leadLabel, isPlaceholderLabel } from "@/lib/lead-label";

// The Overview's "Latest leads" block. Deliberately editable in place: the
// most common thing anyone wants to do with a fresh lead is put a name to a
// phone number and jot down what was said, and making them navigate to the
// Leads page first is how that stops happening. Everything written here is
// the same record the Leads board shows — one lead, one truth.

export type LatestLeadVM = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  sourceLabel: string;
  receivedAt: Date;
  noteCount: number;
};

function when(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function LeadRow({ lead }: { lead: LatestLeadVM }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(lead.name ?? "");
  const [note, setNote] = useState("");
  const [nameState, setNameState] = useState<"idle" | "saving" | "saved">("idle");
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved">("idle");
  const [noteCount, setNoteCount] = useState(lead.noteCount);
  const [error, setError] = useState<string | null>(null);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const heading = leadLabel(lead);
  const needsName = isPlaceholderLabel(lead);

  function onName(v: string) {
    setName(v);
    setNameState("saving");
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(async () => {
      try {
        await renameLead(lead.id, v);
        setNameState(v.trim() ? "saved" : "idle");
      } catch (err) {
        setNameState("idle");
        setError(err instanceof Error ? err.message : String(err));
      }
    }, 700);
  }

  // Notes append rather than overwrite, so this can't quietly destroy
  // something typed earlier. The debounce is longer for the same reason —
  // a pause mid-sentence shouldn't file half a thought.
  function onNote(v: string) {
    setNote(v);
    setNoteState("saving");
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      const body = v.trim();
      if (!body) {
        setNoteState("idle");
        return;
      }
      try {
        await addLeadNote(lead.id, body);
        setNote("");
        setNoteCount((n) => n + 1);
        setNoteState("saved");
      } catch (err) {
        setNoteState("idle");
        setError(err instanceof Error ? err.message : String(err));
      }
    }, 1600);
  }

  return (
    <div className={`wa-latest-item ${open ? "open" : ""}`}>
      <button type="button" className="wa-latest-row" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="wa-latest-main">
          <span className={`wa-latest-name ${needsName ? "unnamed" : ""}`}>{heading}</span>
          <span className="wa-latest-meta">
            {lead.sourceLabel}
            {noteCount > 0 && ` · ${noteCount} note${noteCount === 1 ? "" : "s"}`}
          </span>
        </span>
        <span className="wa-latest-when">{when(lead.receivedAt)}</span>
        <span className="wa-latest-arrow">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="wa-latest-edit">
          <label htmlFor={`n-${lead.id}`}>
            {needsName ? "Who was it? Put a name to this one" : "Their name"}
          </label>
          <input
            id={`n-${lead.id}`}
            value={name}
            placeholder={needsName ? heading : "Their name"}
            onChange={(e) => onName(e.target.value)}
          />
          <span className={`wa-save-state ${nameState === "saved" ? "saved" : nameState}`}>
            {nameState === "saving" ? "Saving…" : nameState === "saved" ? "Saved" : "Saves as you type"}
          </span>

          <label htmlFor={`no-${lead.id}`}>Add a note</label>
          <textarea
            id={`no-${lead.id}`}
            value={note}
            placeholder="e.g. spoke Tuesday, deciding next week"
            onChange={(e) => onNote(e.target.value)}
          />
          <span className={`wa-save-state ${noteState === "saved" ? "saved" : noteState}`}>
            {noteState === "saving" ? "Saving…" : noteState === "saved" ? "Note saved" : "Saves on its own"}
          </span>

          <a className="wa-latest-link" href="/leads">
            Open the full Leads page →
          </a>
          {error && <div className="wa-modal-warn wa-modal-warn-error">{error}</div>}
        </div>
      )}
    </div>
  );
}

export function LatestLeads({ leads }: { leads: LatestLeadVM[] }) {
  return (
    <div className="wa-latest-list">
      {leads.map((l) => (
        <LeadRow key={l.id} lead={l} />
      ))}
    </div>
  );
}
