import type { ReactNode } from "react";

// One metric card on The Numbers page. Deliberately dumb — the page owns
// the copy (registry) and the values (resolvers); this only lays them out.
export function NumberCard({
  label,
  value,
  support,
  plain,
  status,
  statusTone = "on",
  healthyRange,
  improvements,
  gold = false,
}: {
  label: ReactNode;
  value: ReactNode;
  support?: ReactNode;
  plain?: ReactNode;
  status?: ReactNode;
  statusTone?: "on" | "attn" | "watch";
  healthyRange?: ReactNode;
  improvements?: ReactNode;
  /** Gold outline for the handful of numbers the whole page is about. */
  gold?: boolean;
}) {
  return (
    <article className={`wa-card wa-number-card ${gold ? "gold" : ""}`}>
      <div className="wa-kpi-label">{label}</div>
      <div className="wa-number-value">{value}</div>
      {support && <div className="wa-number-support">{support}</div>}
      {plain && <div className="wa-number-plain">{plain}</div>}
      {status && <span className={`wa-number-status ${statusTone}`}>{status}</span>}
      {healthyRange && <div className="wa-number-healthy">{healthyRange}</div>}
      {improvements && (
        <>
          <div className="wa-number-improve-title">What we do about it</div>
          <div className="wa-number-improve">{improvements}</div>
        </>
      )}
    </article>
  );
}
