"use client";

import { useRef, useState, useTransition } from "react";
import { saveTaskText, addTaskPhoto, deleteTaskPhoto, toggleTaskDone } from "@/app/(dashboard)/nextsteps/actions";

export type TaskPhotoVM = { id: string; fileName: string | null };
export type TaskVM = {
  id: string;
  title: string;
  explanation: string;
  urgency: string;
  responseType: string; // CHECK | TEXT | PHOTO | BOTH
  done: boolean;
  text: string;
  photos: TaskPhotoVM[];
};

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

export function TaskList({ tasks }: { tasks: TaskVM[] }) {
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
