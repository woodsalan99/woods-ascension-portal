export function formatDealValue(cents: number | null): string {
  if (cents === null) return "";
  if (cents >= 1000) return `$${Math.round(cents / 1000)}K`;
  return `$${cents}`;
}

export function formatDayLabel(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatCallWhen(date: Date, timezone: string): string {
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
  return `${datePart} · ${timePart}`;
}
