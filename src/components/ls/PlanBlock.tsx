"use client";

import { useState } from "react";
import { useEdit } from "@/components/ls/EditProvider";
import { savePlan } from "@/lib/plan-actions";

// "Plan for August" on the Overview — and the only place Alan should need to
// look to change it. Same MonthlyWork.nextMonth field the recap reads, so
// the two can't say different things.
//
// The list is deliberately numbered and evenly weighted rather than bulleted:
// a plan is a sequence of commitments, and numbering makes "we said five
// things and did four" legible at a glance.
export function PlanBlock({
  clientId,
  monthLabel,
  items,
  label,
  subtitle,
  emptyText,
}: {
  clientId: string;
  monthLabel: string;
  items: string[];
  label: React.ReactNode;
  subtitle: React.ReactNode;
  emptyText: React.ReactNode;
}) {
  const ed = useEdit();
  const canEdit = Boolean(ed);

  const [rows, setRows] = useState<string[]>(items.length > 0 ? items : [""]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      await savePlan(clientId, rows);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const live = rows.map((r) => r.trim()).filter(Boolean);
  const showing = editing ? live : items;

  // Nothing written and nobody who could write it — say so plainly rather
  // than rendering an empty gold box.
  if (showing.length === 0 && !editing && !canEdit) {
    return (
      <div className="wa-card wa-plan">
        <div className="wa-plan-head">
          <div className="wa-plan-eyebrow">{label}</div>
          <h2 className="wa-plan-title">Plan for {monthLabel}</h2>
        </div>
        <p className="wa-page-sub">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="wa-card wa-plan">
      <div className="wa-plan-head">
        <div>
          <div className="wa-plan-eyebrow">{label}</div>
          <h2 className="wa-plan-title">Plan for {monthLabel}</h2>
          <p className="wa-plan-sub">{subtitle}</p>
        </div>
        {canEdit && !editing && (
          <button type="button" className="wa-plan-edit" onClick={() => setEditing(true)}>
            {items.length === 0 ? "Write the plan" : "Edit plan"}
          </button>
        )}
        {saved && <span className="wa-save-state saved">Saved</span>}
      </div>

      {!editing ? (
        showing.length === 0 ? (
          <p className="wa-page-sub">{emptyText}</p>
        ) : (
          <ol className="wa-plan-list">
            {showing.map((item, i) => (
              <li key={i}>
                <span className="wa-plan-num">{i + 1}</span>
                <span className="wa-plan-text">{item}</span>
              </li>
            ))}
          </ol>
        )
      ) : (
        <div className="wa-plan-editor">
          {rows.map((row, i) => (
            <div key={i} className="wa-plan-row">
              <span className="wa-plan-num">{i + 1}</span>
              <input
                value={row}
                autoFocus={i === rows.length - 1 && row === ""}
                placeholder="e.g. Six more town pages, weighted windward"
                onChange={(e) => setRows((r) => r.map((v, j) => (j === i ? e.target.value : v)))}
                onKeyDown={(e) => {
                  // Enter adds the next line, the way a list should behave.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setRows((r) => [...r.slice(0, i + 1), "", ...r.slice(i + 1)]);
                  }
                }}
              />
              <button
                type="button"
                className="wa-plan-remove"
                aria-label="Remove this line"
                onClick={() => setRows((r) => (r.length === 1 ? [""] : r.filter((_, j) => j !== i)))}
              >
                ×
              </button>
            </div>
          ))}

          <div className="wa-plan-actions">
            <button type="button" className="wa-plan-add" onClick={() => setRows((r) => [...r, ""])}>
              + Add another
            </button>
            <div className="wa-plan-actions-right">
              <button
                type="button"
                className="wa-btn-ghost"
                disabled={busy}
                onClick={() => {
                  setRows(items.length > 0 ? items : [""]);
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
              <button type="button" className="wa-btn-primary" disabled={busy} onClick={commit}>
                {busy ? "Saving…" : "Save plan"}
              </button>
            </div>
          </div>
          {error && <div className="wa-modal-warn wa-modal-warn-error">{error}</div>}
        </div>
      )}
    </div>
  );
}
