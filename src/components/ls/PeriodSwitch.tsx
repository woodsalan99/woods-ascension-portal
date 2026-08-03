import Link from "next/link";
import type { PeriodOption } from "@/lib/ls-periods";

// Plain links, not a dropdown: every option is visible at a glance, each one
// is a real URL the client can bookmark or share, and it works with
// JavaScript off. `basePath` is the page it belongs to.
export function PeriodSwitch({
  basePath,
  options,
  current,
  rangeLabel,
}: {
  basePath: string;
  options: PeriodOption[];
  current: string;
  rangeLabel: string;
}) {
  return (
    <div className="wa-period-switch">
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.value === options[0].value ? basePath : `${basePath}?p=${o.value}`}
          className={o.value === current ? "on" : ""}
          aria-current={o.value === current ? "page" : undefined}
        >
          {o.label}
        </Link>
      ))}
      <span className="wa-weekbadge">{rangeLabel}</span>
    </div>
  );
}
