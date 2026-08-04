// Small "↑16% vs prior 30 days" / "+1 page" badge under a KPI value.
// Two display modes because a percent reads badly on numbers this small:
// pages showing and reviews always render as a plain count delta, never a
// percentage — "+1 page" beats "+5%" when the base is already 19 of 20.
export function TrendBadge({
  deltaPct,
  deltaAbs,
  unit,
  label = "vs prior 30 days",
}: {
  deltaPct?: number | null;
  deltaAbs?: number | null;
  unit?: string;
  label?: string;
}) {
  const usingAbs = deltaAbs !== undefined;
  const value = usingAbs ? deltaAbs : deltaPct;

  if (value === null || value === undefined) return null;
  if (value === 0) return <span className="wa-trend flat">No change {label}</span>;

  const up = value > 0;
  const text = usingAbs
    ? `${up ? "+" : ""}${value}${unit ? ` ${unit}${Math.abs(value) === 1 ? "" : "s"}` : ""}`
    : `${up ? "↑" : "↓"} ${Math.abs(value)}%`;

  return (
    <span className={`wa-trend ${up ? "up" : "down"}`}>
      {text} {label}
    </span>
  );
}
