"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { publishPortalChanges } from "@/lib/content-actions";
import type { ContentKey } from "@/content/local-services";

// Admin-only "edit this page" system for local-services pages. Two tiers:
//   COPY (everything in the content registry) — freely editable.
//   DATA (numbers from resolveMetrics) — rendered locked; unlocking needs
//     an explicit confirmation, and the override rides the same
//     diff-review -> publish flow as copy edits.
// Nothing autosaves. Discard reverts everything. See IMPLEMENTATION_STATE.md
// §3a/§3c — one deliberate deviation from that sketch: fields are plain
// React-controlled <input>/<textarea> elements instead of contentEditable.
// contentEditable fights React's rendering model (cursor jumps, awkward
// sync); controlled inputs give the identical product behavior — click a
// field, type, nothing saves until Publish — with far less fragility.

type DirtyCopy = { kind: "copy"; label: string; from: string; to: string };
type DirtyData = { kind: "data"; label: string; from: string; to: string };
type DirtyEntry = DirtyCopy | DirtyData;

type UnlockRequest = { scopeKey: string; label: string; liveDisplay: string; asOf: Date | null };

type EditContextValue = {
  editing: boolean;
  canEdit: boolean;
  dirty: Map<string, DirtyEntry>;
  currentCopy: (key: ContentKey, original: string) => string;
  markCopyDirty: (key: ContentKey, label: string, original: string, next: string) => void;
  isUnlocked: (scopeKey: string) => boolean;
  currentData: (scopeKey: string, original: string) => string;
  markDataDirty: (scopeKey: string, label: string, original: string, next: string) => void;
  requestUnlock: (req: UnlockRequest) => void;
};

const EditContext = createContext<EditContextValue | null>(null);

export function useEdit(): EditContextValue | null {
  return useContext(EditContext);
}

function dirtyKeyFor(kind: "copy" | "data", key: string): string {
  return `${kind}:${key}`;
}

// Groups the diff list the way the mock does: copy entries by their key's
// leading "page" segment (before the first "."), data-tier entries in
// their own "Reported numbers" section, flagged separately.
function groupLabel(key: string, kind: "copy" | "data"): string {
  if (kind === "data") return "Reported numbers";
  const seg = key.split(".")[0];
  return seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function EditProvider({
  clientId,
  canEdit,
  children,
}: {
  clientId: string;
  canEdit: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState<Map<string, DirtyEntry>>(new Map());
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [pendingUnlock, setPendingUnlock] = useState<UnlockRequest | null>(null);
  const [unlockAgreed, setUnlockAgreed] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  function enterEdit() {
    if (!canEdit) return;
    setEditing(true);
    setDirty(new Map());
    setUnlocked(new Set());
  }

  function exitEdit() {
    setEditing(false);
    setDirty(new Map());
    setUnlocked(new Set());
    setShowDiff(false);
    setPublishError(null);
  }

  function markCopyDirty(key: ContentKey, label: string, original: string, next: string) {
    setDirty((prev) => {
      const map = new Map(prev);
      const id = dirtyKeyFor("copy", key);
      if (next === original) map.delete(id);
      else map.set(id, { kind: "copy", label, from: original, to: next });
      return map;
    });
  }

  function markDataDirty(scopeKey: string, label: string, original: string, next: string) {
    setDirty((prev) => {
      const map = new Map(prev);
      const id = dirtyKeyFor("data", scopeKey);
      if (next === original) map.delete(id);
      else map.set(id, { kind: "data", label, from: original, to: next });
      return map;
    });
  }

  function requestUnlock(req: UnlockRequest) {
    setPendingUnlock(req);
    setUnlockAgreed(false);
  }

  function confirmUnlock() {
    if (!pendingUnlock) return;
    setUnlocked((prev) => new Set(prev).add(pendingUnlock.scopeKey));
    setPendingUnlock(null);
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    const changes = [...dirty.entries()]
      .filter(([id]) => id.startsWith("copy:"))
      .map(([id, entry]) => ({ key: id.slice("copy:".length) as ContentKey, value: entry.to }));
    const overrides = [...dirty.entries()]
      .filter(([id]) => id.startsWith("data:"))
      .map(([id, entry]) => ({ scopeKey: id.slice("data:".length), value: entry.to, originalValue: entry.from }));

    const result = await publishPortalChanges({ clientId, changes, overrides });
    setPublishing(false);
    if (!result.ok) {
      setPublishError(result.error);
      return;
    }
    setShowDiff(false);
    exitEdit();
    router.refresh();
  }

  const value = useMemo<EditContextValue>(
    () => ({
      editing,
      canEdit,
      dirty,
      currentCopy: (key, original) => dirty.get(dirtyKeyFor("copy", key))?.to ?? original,
      markCopyDirty,
      isUnlocked: (scopeKey) => unlocked.has(scopeKey),
      currentData: (scopeKey, original) => dirty.get(dirtyKeyFor("data", scopeKey))?.to ?? original,
      markDataDirty,
      requestUnlock,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, canEdit, dirty, unlocked],
  );

  const dirtyCount = dirty.size;
  const dataDirtyCount = [...dirty.keys()].filter((k) => k.startsWith("data:")).length;

  const groups = new Map<string, { id: string; entry: DirtyEntry }[]>();
  for (const [id, entry] of dirty) {
    const key = id.slice(id.indexOf(":") + 1);
    const g = groupLabel(key, entry.kind);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push({ id, entry });
  }

  return (
    <EditContext.Provider value={value}>
      {canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          {!editing ? (
            <button className="wa-edit-toggle" onClick={enterEdit}>
              <span className="wa-edit-dot" /> Edit page
            </button>
          ) : (
            <button className="wa-edit-toggle wa-edit-toggle-on" onClick={exitEdit}>
              <span className="wa-edit-dot" /> Editing
            </button>
          )}
        </div>
      )}

      {editing && (
        <div className="wa-editbar">
          <div className="wa-editbar-left">
            <b>Edit mode</b>
            <span className="wa-editbar-hint">
              Type in any field to change it. Numbers pulled from a live source need unlocking first.
            </span>
          </div>
          <div className="wa-editbar-right">
            <span className={`wa-editbar-count ${dirtyCount > 0 ? "dirty" : ""}`}>
              {dirtyCount === 0 ? "No changes yet" : `${dirtyCount} change${dirtyCount > 1 ? "s" : ""} not yet saved`}
            </span>
            <button className="wa-btn-ghost" onClick={exitEdit}>
              Discard
            </button>
            <button className="wa-btn-primary" disabled={dirtyCount === 0} onClick={() => setShowDiff(true)}>
              Save changes
            </button>
          </div>
        </div>
      )}

      {children}

      {showDiff && (
        <div className="wa-modal-bg" onClick={() => !publishing && setShowDiff(false)}>
          <div className="wa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-head">
              <h2 className="wa-h2">Review before saving</h2>
              <p className="wa-page-sub">Nothing goes live until you confirm. This is exactly what the client will see.</p>
            </div>
            <div className="wa-modal-body">
              {dataDirtyCount > 0 && (
                <div className="wa-modal-warn">
                  <b>
                    {dataDirtyCount} reported number{dataDirtyCount > 1 ? "s" : ""} overridden by hand.
                  </b>{" "}
                  These will show your value instead of the live one until reset.
                </div>
              )}
              {[...groups.entries()].map(([group, rows]) => (
                <div key={group} className="wa-diff-group">
                  <div className="wa-diff-group-head">{group}</div>
                  {rows.map(({ id, entry }) => (
                    <div key={id} className="wa-diff-row">
                      <div className="wa-diff-where">
                        {entry.label}
                        {entry.kind === "data" ? " · reported number" : ""}
                      </div>
                      <span className="wa-diff-old">{entry.from || "(empty)"}</span>
                      <span className="wa-diff-new">{entry.to || "(empty)"}</span>
                    </div>
                  ))}
                </div>
              ))}
              {publishError && <div className="wa-modal-warn wa-modal-warn-error">{publishError}</div>}
            </div>
            <div className="wa-modal-foot">
              <button className="wa-btn-ghost" disabled={publishing} onClick={() => setShowDiff(false)}>
                Back
              </button>
              <button className="wa-btn-primary" disabled={publishing} onClick={handlePublish}>
                {publishing ? "Publishing…" : "Publish changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingUnlock && (
        <div className="wa-modal-bg" onClick={() => setPendingUnlock(null)}>
          <div className="wa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wa-modal-head">
              <h2 className="wa-h2">Change a reported number?</h2>
              <p className="wa-page-sub">This figure is pulled automatically from a connected source.</p>
            </div>
            <div className="wa-modal-body">
              <div className="wa-modal-warn">
                <b>Only override this if you know the live source is wrong or out of date.</b>
                <br />
                Once you edit it by hand, it stops updating automatically until you reset it — and the client sees
                your number, not the live one.
              </div>
              <div className="wa-diff-row">
                <div className="wa-diff-where">Field</div>
                <span className="wa-diff-new">{pendingUnlock.label}</span>
              </div>
              <div className="wa-diff-row">
                <div className="wa-diff-where">Current value from source</div>
                <span className="wa-diff-new">{pendingUnlock.liveDisplay}</span>
              </div>
              <div className="wa-diff-row">
                <div className="wa-diff-where">Last pulled</div>
                <span className="wa-diff-new">
                  {pendingUnlock.asOf ? pendingUnlock.asOf.toLocaleString("en-US") : "Never — no data yet"}
                </span>
              </div>
              <label className="wa-confirm-line">
                <input type="checkbox" checked={unlockAgreed} onChange={(e) => setUnlockAgreed(e.target.checked)} />
                I understand this replaces the live number
              </label>
            </div>
            <div className="wa-modal-foot">
              <button className="wa-btn-ghost" onClick={() => setPendingUnlock(null)}>
                Cancel
              </button>
              <button className="wa-btn-primary" disabled={!unlockAgreed} onClick={confirmUnlock}>
                Unlock for editing
              </button>
            </div>
          </div>
        </div>
      )}
    </EditContext.Provider>
  );
}
