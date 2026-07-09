"use client";

import { useRef, useTransition } from "react";

export function OutcomeSelect({
  entryId,
  currentOutcome,
  action,
}: {
  entryId: string;
  currentOutcome: string;
  action: (entryId: string, formData: FormData) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) => startTransition(() => action(entryId, formData))}
    >
      <select
        name="outcome"
        defaultValue={currentOutcome}
        disabled={isPending}
        onChange={() => formRef.current?.requestSubmit()}
        className="wa-select"
        style={{ fontSize: 12.5, padding: "5px 8px" }}
      >
        <option value="PENDING">Pending</option>
        <option value="QUALIFIED">Qualified</option>
        <option value="NOT_QUALIFIED">Not qualified</option>
        <option value="NO_SHOW">No-show</option>
      </select>
    </form>
  );
}
