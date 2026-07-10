"use client";

import { useState, useTransition } from "react";

export function OutcomeSelect({
  entryId,
  currentOutcome,
  currentNotes,
  action,
}: {
  entryId: string;
  currentOutcome: string;
  currentNotes: string;
  action: (entryId: string, formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(currentNotes);
  const [outcome, setOutcome] = useState(currentOutcome);
  const [dirty, setDirty] = useState(false);

  return (
    <form
      action={(formData) => startTransition(() => action(entryId, formData).then(() => setDirty(false)))}
      style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}
    >
      <select
        name="outcome"
        value={outcome}
        disabled={isPending}
        onChange={(e) => {
          setOutcome(e.target.value);
          setDirty(true);
        }}
        className="wa-select"
        style={{ fontSize: 12.5, padding: "5px 8px" }}
      >
        <option value="PENDING">Pending</option>
        <option value="QUALIFIED">Qualified</option>
        <option value="NOT_QUALIFIED">Not qualified</option>
        <option value="NO_SHOW">No-show</option>
      </select>
      <textarea
        name="notes"
        value={notes}
        disabled={isPending}
        onChange={(e) => {
          setNotes(e.target.value);
          setDirty(true);
        }}
        placeholder="Notes about this lead…"
        rows={2}
        style={{
          fontSize: 12.5,
          padding: "5px 8px",
          border: "1px solid var(--line)",
          borderRadius: 6,
          resize: "vertical",
        }}
      />
      {dirty && (
        <button
          type="submit"
          disabled={isPending}
          className="wa-ob-cta"
          style={{ fontSize: 11.5, padding: "5px 10px", alignSelf: "flex-start" }}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      )}
    </form>
  );
}
