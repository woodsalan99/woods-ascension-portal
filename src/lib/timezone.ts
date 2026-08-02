// Converts a UTC instant to a "YYYY-MM-DD" date key in the given IANA
// timezone, then back to the UTC-midnight Date the schema stores dates as.
// See §7: "convert event timestamps to the client's IANA timezone before
// assigning a date."
export function dateKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dateKeyToUtcMidnight(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

// "YYYY-MM" in the given IANA timezone — the month-key convention used by
// LsaMonthlyStat, GeogridScan, KeywordRank, MonthlyWork, etc.
export function monthKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

// Human label for a "YYYY-MM" month key, e.g. "2026-08" -> "August 2026".
export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
