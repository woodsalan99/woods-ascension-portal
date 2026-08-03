"use client";

import { useEdit } from "@/components/ls/EditProvider";
import { EList } from "@/components/ls/Editable";
import type { ContentKey } from "@/content/local-services";

// "What controls your position", once per asset. Collapsed by default —
// it's the answer to a question the client only sometimes asks, and three
// open copies of it would bury the numbers they came for.
//
// Each item is one pipe-separated string: heading|body|tag. Same trick as
// the weekly habits, and the same rule about when the raw form appears —
// only once the editor is actually open, never merely in preview. See D42.
export type ControlItem = { heading: string; body: string; tag: string };

function splitControl(raw: string): ControlItem {
  const [heading = "", body = "", tag = ""] = raw.split("|");
  return { heading, body, tag };
}

// Tag wording drives the colour, so Alan can retag an item by editing the
// text and doesn't need a separate field for it.
function tagTone(tag: string): string {
  const t = tag.toLowerCase();
  if (t.includes("biggest")) return "big";
  if (t.includes("nobody")) return "low";
  if (t.includes("already")) return "done";
  return "mid";
}

export function ControlsPanel({ contentKey, items, title }: { contentKey: ContentKey; items: string[]; title: string }) {
  const ed = useEdit();

  if (ed?.editing) {
    return (
      <div className="wa-controls-edit">
        <div className="wa-field-label">{title} — one per line: heading | what it means | tag</div>
        <EList k={contentKey} items={items} label={title} itemLabel="Factor (heading | body | tag)" />
      </div>
    );
  }

  let current = items;
  if (ed) {
    try {
      const parsed = JSON.parse(ed.currentCopy(contentKey, JSON.stringify(items)));
      if (Array.isArray(parsed)) current = parsed;
    } catch {
      current = items;
    }
  }

  return (
    <details className="wa-controls">
      <summary>
        <span>{title}</span>
        <span className="wa-controls-toggle" />
      </summary>
      <div className="wa-controls-body">
        {current.map((raw, i) => {
          const c = splitControl(raw);
          return (
            <div key={i} className="wa-control">
              {c.tag && <div className={`wa-factor-tag ${tagTone(c.tag)}`}>{c.tag}</div>}
              <h4>{c.heading}</h4>
              {c.body && <p>{c.body}</p>}
            </div>
          );
        })}
      </div>
    </details>
  );
}
