"use client";

import { useEdit } from "@/components/ls/EditProvider";
import { EList } from "@/components/ls/Editable";

// Each habit is stored as one pipe-separated string — icon|heading|body|why —
// so Alan can add, remove and reorder them without a schema change.
//
// The page used to branch on `isPreview`, which meant an admin merely LOOKING
// at the portal saw the raw "📞|Pick up, or call back fast|Most homeowners…"
// strings instead of the formatted block. Preview is not editing. This
// branches on `editing`, so the raw form appears only once the editor is
// actually open. See D40.
export type Habit = { icon: string; heading: string; body: string; why: string };

export function splitHabit(raw: string): Habit {
  const [icon = "•", heading = "", body = "", why = ""] = raw.split("|");
  return { icon, heading, body, why };
}

export function HabitList({ items }: { items: string[] }) {
  const ed = useEdit();

  if (ed?.editing) {
    return (
      <EList
        k="ask.habits.items"
        items={items}
        label="Weekly habits"
        itemLabel="Habit (icon | heading | what to do | why it matters)"
      />
    );
  }

  // Read the live edited values when they exist, so a change made in the
  // editor is visible the moment the editor closes rather than after publish.
  let current = items;
  if (ed) {
    try {
      const raw = ed.currentCopy("ask.habits.items", JSON.stringify(items));
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) current = parsed;
    } catch {
      current = items;
    }
  }

  return (
    <div>
      {current.map((raw, i) => {
        const h = splitHabit(raw);
        return (
          <div key={i} className="wa-habit">
            <div className="wa-habit-ico">{h.icon}</div>
            <div>
              <b>{h.heading}</b>
              {h.body && <p>{h.body}</p>}
              {h.why && <div className="wa-habit-why">{h.why}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
