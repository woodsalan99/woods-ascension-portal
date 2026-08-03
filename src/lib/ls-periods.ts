import { LAST_30, LAST_90, isRolling } from "@/lib/ls-metrics";
import { formatMonthKey, monthKeyInTimezone } from "@/lib/timezone";

// The window options offered on the Overview and The Numbers. Rolling by
// default everywhere: month-to-date on the 2nd of the month shows a nearly
// empty page, which reads as "nothing is happening" rather than "the month
// just started". See D33.

export type PeriodOption = { value: string; label: string };

function monthsBack(monthKey: string, n: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function periodOptions(timezone: string, now = new Date()): PeriodOption[] {
  const thisMonth = monthKeyInTimezone(now, timezone);
  return [
    { value: LAST_30, label: "Last 30 days" },
    { value: "mtd", label: "This month so far" },
    { value: monthsBack(thisMonth, 1), label: formatMonthKey(monthsBack(thisMonth, 1)) },
    { value: monthsBack(thisMonth, 2), label: formatMonthKey(monthsBack(thisMonth, 2)) },
    { value: monthsBack(thisMonth, 3), label: formatMonthKey(monthsBack(thisMonth, 3)) },
    { value: LAST_90, label: "Last 90 days" },
  ];
}

/** Turns the `?p=` value into a period a resolver understands. */
export function resolvePeriod(raw: string | undefined, timezone: string, now = new Date()) {
  const thisMonth = monthKeyInTimezone(now, timezone);
  const options = periodOptions(timezone, now);
  const chosen = options.find((o) => o.value === raw) ?? options[0];
  // "mtd" is a label, not a period — it means the current calendar month.
  const period = chosen.value === "mtd" ? thisMonth : chosen.value;
  return { value: chosen.value, label: chosen.label, period, rolling: isRolling(period) };
}

/** Human date range for the badge beside the picker. */
export function periodRangeLabel(period: string, timezone: string, now = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: timezone });
  if (period === LAST_30) return `${day(new Date(now.getTime() - 30 * 86_400_000))} – ${day(now)}`;
  if (period === LAST_90) return `${day(new Date(now.getTime() - 90 * 86_400_000))} – ${day(now)}`;
  if (period === monthKeyInTimezone(now, timezone)) {
    return `${now.toLocaleDateString("en-US", { month: "long", timeZone: timezone })} 1 – ${day(now)}`;
  }
  return formatMonthKey(period);
}
