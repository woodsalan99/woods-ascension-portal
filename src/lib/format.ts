const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

// Rough placeholder for auto-added pipeline entries — admin can correct it.
// Smartlead's reply data doesn't reliably include a company name.
export function guessCompanyFromEmail(email: string): string {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) return "";
  const base = domain.split(".")[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

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
