"use client";

import { useEdit } from "@/components/ls/EditProvider";
import { parseCopyMarkup } from "@/lib/copy-markup";
import type { ContentKey } from "@/content/local-services";

type Tag = "span" | "p" | "h1" | "h2" | "h3";

// The ONLY way registry copy renders on a local-services page. Outside edit
// mode: plain text (with "**bold**" markup rendered as <b>). In edit mode:
// a controlled textarea — see EditProvider.tsx for why this is a plain
// input rather than contentEditable.
export function E({
  k,
  v,
  label,
  as: Tag = "span",
  multiline = false,
}: {
  k: ContentKey;
  v: string;
  label: string;
  as?: Tag;
  multiline?: boolean;
}) {
  const ed = useEdit();
  if (!ed) return <Tag>{v}</Tag>;

  const current = ed.currentCopy(k, v);

  if (!ed.editing) {
    const runs = parseCopyMarkup(current);
    if (runs.length <= 1) return <Tag>{current}</Tag>;
    return (
      <Tag>
        {runs.map((r, i) => (r.bold ? <b key={i}>{r.text}</b> : <span key={i}>{r.text}</span>))}
      </Tag>
    );
  }

  const Field = multiline ? "textarea" : "input";
  return (
    <Field
      className={`wa-edit-field ${multiline ? "wa-edit-field-multiline" : ""}`}
      value={current}
      onChange={(e) => ed.markCopyDirty(k, label, v, e.target.value)}
      aria-label={label}
    />
  );
}

// A registry key whose value is a JSON-encoded array of strings, where
// Alan may change the number of items (thesis bullets, weekly habits).
// One key, one ordered list — not one key per item.
export function EList({ k, items, label, itemLabel }: { k: ContentKey; items: string[]; label: string; itemLabel: string }) {
  const ed = useEdit();
  if (!ed) {
    return (
      <ul className="wa-edit-list">
        {items.map((item, i) => {
          const runs = parseCopyMarkup(item);
          return (
            <li key={i}>{runs.map((r, j) => (r.bold ? <b key={j}>{r.text}</b> : <span key={j}>{r.text}</span>))}</li>
          );
        })}
      </ul>
    );
  }

  const raw = ed.currentCopy(k, JSON.stringify(items));
  let current: string[];
  try {
    current = JSON.parse(raw);
  } catch {
    current = items;
  }

  if (!ed.editing) {
    return (
      <ul className="wa-edit-list">
        {current.map((item, i) => {
          const runs = parseCopyMarkup(item);
          return (
            <li key={i}>{runs.map((r, j) => (r.bold ? <b key={j}>{r.text}</b> : <span key={j}>{r.text}</span>))}</li>
          );
        })}
      </ul>
    );
  }

  function commit(next: string[]) {
    ed!.markCopyDirty(k, label, JSON.stringify(items), JSON.stringify(next));
  }

  return (
    <div className="wa-edit-list-editor">
      {current.map((item, i) => (
        <div key={i} className="wa-edit-list-row">
          <textarea
            className="wa-edit-field wa-edit-field-multiline"
            value={item}
            aria-label={`${itemLabel} ${i + 1}`}
            onChange={(e) => {
              const next = [...current];
              next[i] = e.target.value;
              commit(next);
            }}
          />
          <button
            type="button"
            className="wa-btn-ghost wa-edit-list-remove"
            onClick={() => commit(current.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="wa-btn-ghost" onClick={() => commit([...current, ""])}>
        + Add {itemLabel.toLowerCase()}
      </button>
    </div>
  );
}
