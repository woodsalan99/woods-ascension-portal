"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEdit } from "@/components/ls/EditProvider";
import { resetMetricOverride } from "@/lib/metric-actions";
import type { ResolvedMetric } from "@/lib/ls-metrics";

// The ONLY way a resolved number renders on a local-services page.
// Outside edit mode: the resolved display value, plus (for admins, when
// overridden) a small badge with a one-click reset. In edit mode: locked
// by default — click prompts the unlock confirmation in EditProvider;
// once unlocked it becomes an editable field, same dirty-tracking pattern
// as <E>. See IMPLEMENTATION_STATE.md §3c.
export function Num({ m, clientId, label }: { m: ResolvedMetric; clientId: string; label: string }) {
  const ed = useEdit();
  const router = useRouter();
  const [resetting, setResetting] = useState(false);

  if (!ed) return <>{m.display}</>;

  if (!ed.editing) {
    // Graceful zero-data (IMPLEMENTATION_STATE.md §3c): a composite resolver
    // with nothing to say yet (e.g. no leads this month) returns "" rather
    // than a misleading zero — render nothing rather than an empty line.
    if (!m.overridden && m.display === "") return null;
    if (!m.overridden) return <>{m.display}</>;
    return (
      <span className="wa-num-overridden">
        {m.display}
        <span className="wa-num-badge" title={`Live value is ${m.liveDisplay}`}>
          overridden
          <button
            type="button"
            className="wa-num-reset"
            disabled={resetting}
            onClick={async () => {
              setResetting(true);
              await resetMetricOverride(clientId, m.scopeKey);
              router.refresh();
            }}
          >
            {resetting ? "…" : "reset"}
          </button>
        </span>
      </span>
    );
  }

  const unlocked = ed.isUnlocked(m.scopeKey);

  if (!unlocked) {
    return (
      <span
        className="wa-num-locked"
        role="button"
        tabIndex={0}
        onClick={() => ed.requestUnlock({ scopeKey: m.scopeKey, label, liveDisplay: m.liveDisplay, asOf: m.asOf })}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            ed.requestUnlock({ scopeKey: m.scopeKey, label, liveDisplay: m.liveDisplay, asOf: m.asOf });
          }
        }}
      >
        🔒 {m.display || "—"}
      </span>
    );
  }

  // Seeded from the currently-shown value (m.display — the override if one
  // already existed), but the dirty-tracking baseline is always the true
  // live value, so originalValue published to the server is never a stale
  // previous override.
  const current = ed.currentData(m.scopeKey, m.display);
  return (
    <input
      className="wa-edit-field wa-edit-field-num"
      value={current}
      aria-label={label}
      onChange={(e) => ed.markDataDirty(m.scopeKey, label, m.liveDisplay, e.target.value)}
    />
  );
}
