"use client";

import { useRef, useState, useTransition } from "react";
import {
  saveTaskText,
  addTaskPhoto,
  deleteTaskPhoto,
  toggleTaskDone,
  saveTask,
  deleteTask,
  reorderTasks,
} from "@/app/(dashboard)/nextsteps/actions";
import { useEdit } from "@/components/ls/EditProvider";

export type TaskPhotoVM = { id: string; fileName: string | null };
export type TaskVM = {
  id: string;
  title: string;
  explanation: string;
  urgency: string;
  responseType: string; // CHECK | TEXT | PHOTO | BOTH
  dueAt: string | null; // YYYY-MM-DD, most tasks have none
  done: boolean;
  text: string;
  photos: TaskPhotoVM[];
};

const RESPONSE_TYPES = [
  { v: "CHECK", label: "Just tick it off" },
  { v: "TEXT", label: "Type an answer" },
  { v: "PHOTO", label: "Upload photos" },
  { v: "BOTH", label: "Type and upload" },
];

// Suggestions, not a fixed list — the field is free text, so Alan can write
// whatever fits. These are just the ones he uses.
const URGENCY_SUGGESTIONS = ["Highest priority", "This week", "Every job", "Whenever you can", "Overdue"];

// "in 3 days" beats a date a client has to subtract from today.
function dueLabel(dueAt: string): { text: string; overdue: boolean } {
  const due = new Date(`${dueAt}T12:00:00Z`).getTime();
  const days = Math.round((due - Date.now()) / 86_400_000);
  if (days < 0) return { text: days === -1 ? "1 day late" : `${Math.abs(days)} days late`, overdue: true };
  if (days === 0) return { text: "Due today", overdue: false };
  if (days === 1) return { text: "Due tomorrow", overdue: false };
  if (days <= 14) return { text: `Due in ${days} days`, overdue: false };
  return {
    text: `Due ${new Date(`${dueAt}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    overdue: false,
  };
}

// Shrinks a photo in the browser before it ever leaves the phone: longest
// edge capped, re-encoded as webp, quality stepped down until it fits.
// Keeps stored photos ~50KB instead of the 3-5MB a modern phone produces,
// which is what makes storing them in the database sane at all.
const MAX_EDGE = 1600;
const TARGET_BYTES = 50 * 1024;

async function compressToWebpDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image on this device.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  for (const quality of [0.8, 0.65, 0.5, 0.4, 0.3]) {
    const url = canvas.toDataURL("image/webp", quality);
    // base64 is ~4/3 the byte size of what it encodes.
    if ((url.length * 3) / 4 <= TARGET_BYTES) return url;
  }
  return canvas.toDataURL("image/webp", 0.25);
}

function SaveState({ state }: { state: "idle" | "saving" | "saved" }) {
  if (state === "saving") return <span className="wa-save-state saving">Saving…</span>;
  if (state === "saved") return <span className="wa-save-state saved">Saved · Alan has been notified</span>;
  return <span className="wa-save-state">Saves as you type</span>;
}

function TaskCard({ task }: { task: TaskVM }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(task.text);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(task.text ? "saved" : "idle");
  const [photos, setPhotos] = useState(task.photos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const wantsText = task.responseType === "TEXT" || task.responseType === "BOTH";
  const wantsPhoto = task.responseType === "PHOTO" || task.responseType === "BOTH";

  function onTextChange(v: string) {
    setText(v);
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await saveTaskText(task.id, v);
        setSaveState(v.trim() ? "saved" : "idle");
      } catch (err) {
        setSaveState("idle");
        setError(err instanceof Error ? err.message : String(err));
      }
    }, 700);
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await compressToWebpDataUrl(file);
        const res = await addTaskPhoto(task.id, dataUrl, file.name);
        setPhotos((p) => [...p, { id: res.id, fileName: file.name }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className={`wa-ask-item ${open ? "open" : ""} ${task.done ? "done" : ""}`}>
      <div className="wa-ask-row">
        <button
          type="button"
          className={`wa-ask-check ${task.done ? "done" : ""}`}
          aria-label={task.done ? "Mark as not done" : "Mark as done"}
          aria-pressed={task.done}
          onClick={() => startTransition(() => void toggleTaskDone(task.id))}
        >
          ✓
        </button>
        <button type="button" className="wa-ask-text" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <b>{task.title}</b>
          {open && <span>{task.explanation}</span>}
        </button>
        <span className={`wa-pill ${task.urgency.toLowerCase().includes("priority") ? "wait" : ""}`}>{task.urgency}</span>
        {task.dueAt && !task.done && (
          <span className={`wa-pill ${dueLabel(task.dueAt).overdue ? "late" : ""}`}>{dueLabel(task.dueAt).text}</span>
        )}
        <span className="wa-ask-arrow">{open ? "▲" : "▼"}</span>
      </div>

      {open && (wantsText || wantsPhoto) && (
        <div className="wa-ask-input">
          {wantsText && (
            <>
              <label htmlFor={`t-${task.id}`}>Type it straight in — one per line is fine</label>
              <textarea
                id={`t-${task.id}`}
                value={text}
                placeholder={"Kalani Medeiros — 808 555 0123\nDenise Tanaka — 808 555 0198"}
                onChange={(e) => onTextChange(e.target.value)}
              />
              <div className="wa-ask-save-row">
                <SaveState state={saveState} />
              </div>
            </>
          )}

          {wantsPhoto && (
            <>
              <label>Add photos</label>
              <button type="button" className="wa-dropzone" onClick={() => fileInput.current?.click()} disabled={busy}>
                <div className="wa-dz-ico">📷</div>
                <b>{busy ? "Adding…" : "Tap to add photos"}</b>
                <span>Straight off your phone — we shrink them for you</span>
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => void onFiles(e.target.files)}
              />
              {photos.length > 0 && (
                <div className="wa-thumbs">
                  {photos.map((p) => (
                    <div key={p.id} className="wa-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/task-photo/${p.id}`} alt={p.fileName ?? "Job photo"} />
                      <button
                        type="button"
                        className="wa-thumb-x"
                        aria-label="Remove photo"
                        onClick={() => {
                          setPhotos((ps) => ps.filter((x) => x.id !== p.id));
                          startTransition(() => void deleteTaskPhoto(p.id));
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="wa-ask-save-row">
                <span className={`wa-save-state ${photos.length ? "saved" : ""}`}>
                  {photos.length ? `${photos.length} saved · Alan has been notified` : "Saved automatically"}
                </span>
              </div>
            </>
          )}

          {error && <div className="wa-modal-warn wa-modal-warn-error" style={{ marginTop: 10 }}>{error}</div>}
        </div>
      )}
    </div>
  );
}

const BLANK: TaskVM = {
  id: "",
  title: "",
  explanation: "",
  urgency: "This week",
  responseType: "CHECK",
  dueAt: null,
  done: false,
  text: "",
  photos: [],
};

// The editor Alan gets in edit mode. Everything about a task is here —
// wording, order, how they reply, and an optional deadline — so he never has
// to leave the page he's looking at to change what it asks for.
function TaskEditor({ clientId, tasks }: { clientId: string; tasks: TaskVM[] }) {
  const [order, setOrder] = useState(tasks);
  const [draft, setDraft] = useState<TaskVM | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function move(index: number, by: number) {
    const next = order.slice();
    const to = index + by;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    setOrder(next);
    startTransition(() => void reorderTasks(clientId, next.map((t) => t.id)).catch((e) => setError(String(e))));
  }

  async function submit() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await saveTask(clientId, {
        id: draft.id || undefined,
        title: draft.title,
        explanation: draft.explanation,
        urgency: draft.urgency,
        responseType: draft.responseType,
        dueAt: draft.dueAt,
      });
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wa-task-editor">
      <div className="wa-admin-tag">
        <i />
        Only you can see this · task editor
      </div>

      {order.map((t, i) => (
        <div key={t.id} className="wa-task-edit-row">
          <div className="wa-task-edit-move">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
              ▲
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Move down">
              ▼
            </button>
          </div>
          <div className="wa-task-edit-main">
            <b>{t.title}</b>
            <span>
              {t.urgency}
              {t.dueAt ? ` · due ${t.dueAt}` : ""} · {RESPONSE_TYPES.find((r) => r.v === t.responseType)?.label}
            </span>
          </div>
          <button type="button" className="wa-task-edit-btn" onClick={() => setDraft(t)}>
            Edit
          </button>
          <button
            type="button"
            className="wa-task-edit-btn danger"
            onClick={() => {
              if (!confirm(`Delete "${t.title}"? Anything they've already typed or uploaded against it goes too.`)) return;
              setOrder((o) => o.filter((x) => x.id !== t.id));
              startTransition(() => void deleteTask(clientId, t.id).catch((e) => setError(String(e))));
            }}
          >
            Delete
          </button>
        </div>
      ))}

      <button type="button" className="wa-btn-primary" style={{ marginTop: 12 }} onClick={() => setDraft({ ...BLANK })}>
        + Add a task
      </button>

      {draft && (
        <div className="wa-modal-bg" onClick={() => !busy && setDraft(null)}>
          <div className="wa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-head">
              <h2 className="wa-h2">{draft.id ? "Edit this task" : "New task"}</h2>
              <p className="wa-page-sub">This is exactly what they&apos;ll see on their page.</p>
            </div>
            <div className="wa-modal-body">
              <label className="wa-field-label">What you need from them</label>
              <input
                className="wa-edit-field"
                autoFocus
                value={draft.title}
                placeholder="Send me any recent customer names for reviews"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />

              <label className="wa-field-label">Why it matters — they see this when they tap it open</label>
              <textarea
                className="wa-edit-field wa-edit-field-multiline"
                value={draft.explanation}
                placeholder="Reviews are the single biggest thing deciding your Google Maps position."
                onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
              />

              <label className="wa-field-label">The little label on the right</label>
              <input
                className="wa-edit-field"
                list="wa-urgency-options"
                value={draft.urgency}
                onChange={(e) => setDraft({ ...draft, urgency: e.target.value })}
              />
              <datalist id="wa-urgency-options">
                {URGENCY_SUGGESTIONS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>

              <label className="wa-field-label">How they reply</label>
              <select
                className="wa-edit-field"
                value={draft.responseType}
                onChange={(e) => setDraft({ ...draft, responseType: e.target.value })}
              >
                {RESPONSE_TYPES.map((r) => (
                  <option key={r.v} value={r.v}>
                    {r.label}
                  </option>
                ))}
              </select>

              <label className="wa-field-label">Deadline — optional, most tasks won&apos;t need one</label>
              <input
                className="wa-edit-field"
                type="date"
                value={draft.dueAt ?? ""}
                onChange={(e) => setDraft({ ...draft, dueAt: e.target.value || null })}
              />

              {error && <div className="wa-modal-warn wa-modal-warn-error">{error}</div>}
            </div>
            <div className="wa-modal-foot">
              <button className="wa-btn-ghost" onClick={() => setDraft(null)} disabled={busy}>
                Cancel
              </button>
              <button className="wa-btn-primary" onClick={submit} disabled={busy || !draft.title.trim()}>
                {busy ? "Saving…" : draft.id ? "Save changes" : "Add it"}
              </button>
            </div>
          </div>
        </div>
      )}
      {error && !draft && <div className="wa-modal-warn wa-modal-warn-error">{error}</div>}
    </div>
  );
}

export function TaskList({ tasks, clientId }: { tasks: TaskVM[]; clientId: string }) {
  const ed = useEdit();

  // Task authoring saves immediately and on its own, unlike copy edits which
  // batch behind Save changes. Mixing the two in one Save button would mean
  // "Discard" silently failing to undo half of it.
  if (ed?.editing) return <TaskEditor clientId={clientId} tasks={tasks} />;

  if (tasks.length === 0) {
    return (
      <div className="wa-empty wa-empty-slim">
        <p>Nothing needed from you right now — this fills in when there is.</p>
      </div>
    );
  }
  return (
    <div className="wa-ask-body">
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} />
      ))}
    </div>
  );
}
