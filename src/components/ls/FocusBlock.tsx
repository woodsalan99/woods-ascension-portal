"use client";

import { useState } from "react";
import { useEdit } from "@/components/ls/EditProvider";
import { saveFocus } from "@/lib/plan-actions";
import type { FocusItem } from "@/lib/generate-focus";

// "Campaign focus" — 2-3 short themes sitting beside the Plan, explaining
// what the plan is FOR. Drafted by DeepSeek whenever the plan is saved
// (plan-actions.ts), never on render — this component only displays and,
// in edit mode, lets Alan override the draft. See D54.
export function FocusBlock({
  clientId,
  auto,
  manual,
  label,
  title,
}: {
  clientId: string;
  auto: FocusItem[];
  manual: FocusItem[] | null;
  label: React.ReactNode;
  title: React.ReactNode;
}) {
  const ed = useEdit();
  const canEdit = Boolean(ed);
  const isOverride = manual !== null && manual.length > 0;
  const shown = isOverride ? manual! : auto;

  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<FocusItem[]>(shown.length > 0 ? shown : [{ icon: "", title: "", body: "" }]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      await saveFocus(clientId, rows);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function revertToAuto() {
    setBusy(true);
    try {
      await saveFocus(clientId, []); // empty clears focusManual, falling back to focusAuto
      setRows(auto.length > 0 ? auto : [{ icon: "", title: "", body: "" }]);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (shown.length === 0 && !editing && !canEdit) return null;

  return (
    <div className="wa-card wa-focus">
      <div className="wa-plan-head">
        <div>
          <div className="wa-plan-eyebrow">{label}</div>
          <h2 className="wa-plan-title">{title}</h2>
        </div>
        {canEdit && !editing && (
          <button type="button" className="wa-plan-edit" onClick={() => setEditing(true)}>
            Edit focus
          </button>
        )}
        {saved && <span className="wa-save-state saved">Saved</span>}
      </div>

      {!editing ? (
        shown.length === 0 ? (
          <p className="wa-page-sub">Written automatically once this month&apos;s plan is saved.</p>
        ) : (
          <div className="wa-focus-list">
            {shown.map((item, i) => (
              <div key={i} className="wa-focus-item">
                <div className="wa-focus-icon">{item.icon}</div>
                <div>
                  <b>{item.title}</b>
                  <p>{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="wa-focus-editor">
          {rows.map((row, i) => (
            <div key={i} className="wa-focus-edit-row">
              <input
                className="wa-focus-icon-input"
                value={row.icon}
                placeholder="📈"
                maxLength={4}
                onChange={(e) => setRows((r) => r.map((v, j) => (j === i ? { ...v, icon: e.target.value } : v)))}
              />
              <div className="wa-focus-edit-fields">
                <input
                  value={row.title}
                  placeholder="Short title"
                  onChange={(e) => setRows((r) => r.map((v, j) => (j === i ? { ...v, title: e.target.value } : v)))}
                />
                <textarea
                  value={row.body}
                  placeholder="One sentence explaining what this is for"
                  onChange={(e) => setRows((r) => r.map((v, j) => (j === i ? { ...v, body: e.target.value } : v)))}
                />
              </div>
              <button
                type="button"
                className="wa-plan-remove"
                aria-label="Remove"
                onClick={() => setRows((r) => (r.length === 1 ? [{ icon: "", title: "", body: "" }] : r.filter((_, j) => j !== i)))}
              >
                ×
              </button>
            </div>
          ))}

          <div className="wa-plan-actions">
            <div style={{ display: "flex", gap: 8 }}>
              {rows.length < 3 && (
                <button
                  type="button"
                  className="wa-plan-add"
                  onClick={() => setRows((r) => [...r, { icon: "", title: "", body: "" }])}
                >
                  + Add another
                </button>
              )}
              {isOverride && (
                <button type="button" className="wa-btn-ghost" disabled={busy} onClick={revertToAuto}>
                  Use the written-for-you version
                </button>
              )}
            </div>
            <div className="wa-plan-actions-right">
              <button type="button" className="wa-btn-ghost" disabled={busy} onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="button" className="wa-btn-primary" disabled={busy} onClick={commit}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
          {error && <div className="wa-modal-warn wa-modal-warn-error">{error}</div>}
        </div>
      )}
    </div>
  );
}
