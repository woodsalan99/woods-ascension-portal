"use client";

import { useRef, useState, useTransition } from "react";
import { addReviewRequest } from "@/app/(dashboard)/nextsteps/actions";

export function ReviewRequestForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <form
        ref={formRef}
        className="wa-review-form"
        action={(fd) => {
          const name = String(fd.get("customerName") ?? "").trim();
          setError(null);
          startTransition(async () => {
            try {
              await addReviewRequest(fd);
              formRef.current?.reset();
              setAdded(name);
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          });
        }}
      >
        <div className="wa-review-field">
          <label htmlFor="rr-name">Customer name</label>
          <input id="rr-name" name="customerName" placeholder="Kalani Medeiros" required />
        </div>
        <div className="wa-review-field">
          <label htmlFor="rr-phone">Their phone number</label>
          <input id="rr-phone" name="phone" type="tel" placeholder="808 555 0123" required />
        </div>
        <div className="wa-review-field">
          <label htmlFor="rr-date">Job finished</label>
          <input id="rr-date" name="jobFinishedAt" type="date" />
        </div>
        <button className="wa-review-submit" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add to the list"}
        </button>
      </form>

      {added && !error && (
        <div className="wa-save-state saved" style={{ marginTop: 10 }}>
          {added} is on the list — we&apos;ll take it from here.
        </div>
      )}
      {error && (
        <div className="wa-modal-warn wa-modal-warn-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
    </>
  );
}
