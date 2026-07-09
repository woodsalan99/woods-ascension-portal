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
