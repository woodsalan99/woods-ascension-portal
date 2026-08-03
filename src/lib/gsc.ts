import { google } from "googleapis";
import { clientFromRefreshToken } from "@/lib/google-oauth";

// Google Search Console — daily clicks/impressions, plus per-page index
// status. The siteUrl is stored per-client in ClientIntegration.config,
// because one Google account can own several clients' properties (Alan's
// owns both oahuhousepainters.com and hawaiiroofingexperts.com) and a
// sync must never read the wrong one.

export type GscDailyRow = { date: string; clicks: number; impressions: number };

function webmasters(refreshToken: string) {
  return google.webmasters({ version: "v3", auth: clientFromRefreshToken(refreshToken) });
}

export async function listProperties(refreshToken: string): Promise<string[]> {
  const res = await webmasters(refreshToken).sites.list();
  return (res.data.siteEntry ?? []).map((s) => s.siteUrl!).filter(Boolean);
}

// Search Analytics is delayed ~2 days and holds ~16 months, so a first
// run can backfill real history rather than starting from today.
export async function fetchDailyStats(params: {
  refreshToken: string;
  siteUrl: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}): Promise<GscDailyRow[]> {
  const res = await webmasters(params.refreshToken).searchanalytics.query({
    siteUrl: params.siteUrl,
    requestBody: {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: ["date"],
      rowLimit: 25000,
    },
  });
  return (res.data.rows ?? []).map((r) => ({
    date: r.keys?.[0] ?? "",
    clicks: Math.round(r.clicks ?? 0),
    impressions: Math.round(r.impressions ?? 0),
  }));
}

// Which URLs Google is actually showing. Cheaper and far more reliable
// than inspecting each page one at a time — a page that has appeared in
// search results at all is, by definition, indexed.
export async function fetchPagesWithImpressions(params: {
  refreshToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
}): Promise<Map<string, { clicks: number; impressions: number }>> {
  const res = await webmasters(params.refreshToken).searchanalytics.query({
    siteUrl: params.siteUrl,
    requestBody: {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: ["page"],
      rowLimit: 25000,
    },
  });
  const out = new Map<string, { clicks: number; impressions: number }>();
  for (const r of res.data.rows ?? []) {
    const url = r.keys?.[0];
    if (!url) continue;
    out.set(normalizeUrl(url), { clicks: Math.round(r.clicks ?? 0), impressions: Math.round(r.impressions ?? 0) });
  }
  return out;
}

// Stored SitePage URLs and GSC's reported URLs differ in trivial ways
// (www vs not, trailing slash, http vs https) — compare on the bare
// host+path so those never cause a false "not indexed".
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
}
