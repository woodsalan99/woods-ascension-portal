// CallRail v3 API wrapper — fetch/pagination conventions templated off
// src/lib/smartlead.ts. Field names and classification logic below are
// now VERIFIED against Alan's real CallRail account (Canencia Painting),
// not just the public docs — see classifyCall for the real setup.
const CALLRAIL_BASE = "https://api.callrail.com/v3";

export type CallRailCall = {
  id: string;
  occurredAt: string; // ISO
  durationSec: number;
  callerNumber: string;
  callerName: string | null; // CallRail's caller-ID lookup — often a real name, sometimes just city/state
  trackingNumber: string;
  keypress: string | null;
  answered: boolean;
  recordingUrl: string | null;
  raw: Record<string, unknown>;
};

export type CallRailConfig = {
  accountId: string;
  // This CallRail account is shared across multiple Woods Ascension
  // clients (Shylee Roofing, Build Atlas, Hawaii Electrical Source, ...) —
  // companyId is REQUIRED to scope calls to just this client. Fetching
  // without it would pull every client's calls into this one's data.
  companyId: string;
  // Tracking numbers routed straight to an LSA line that bypasses normal
  // call screening entirely (always QUALIFIED) — see handoff §3.1/§8.
  // Canencia's Local Service Ads calls bypass CallRail completely (Alan,
  // 2026-08-02), so this is empty for Canencia; kept for a future client
  // whose LSA calls DO route through CallRail.
  lsaTrackingNumbers?: string[];
  cursor?: string; // ISO timestamp of the latest call synced so far
};

function authHeader(apiKey: string): Record<string, string> {
  return { Authorization: `Token token="${apiKey}"` };
}

// Pulls calls for one company within an account since a given ISO
// timestamp, paginated.
export async function fetchCalls(params: {
  apiKey: string;
  accountId: string;
  companyId: string;
  sinceIso: string;
}): Promise<CallRailCall[]> {
  const { apiKey, accountId, companyId, sinceIso } = params;
  const all: CallRailCall[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = new URL(`${CALLRAIL_BASE}/a/${accountId}/calls.json`);
    url.searchParams.set("company_id", companyId);
    url.searchParams.set("start_date", sinceIso.slice(0, 10));
    url.searchParams.set(
      "fields",
      "id,answered,business_phone_number,customer_phone_number,customer_name,duration,start_time,recording,tracking_phone_number,keypad_entries",
    );
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("sort", "start_time");
    url.searchParams.set("order", "asc");

    const res = await fetch(url, { headers: authHeader(apiKey) });
    if (!res.ok) throw new Error(`CallRail fetchCalls failed: ${res.status}`);
    const json = (await res.json()) as { calls: Array<Record<string, unknown>>; total_pages?: number };

    for (const c of json.calls) {
      const startTime = String(c.start_time ?? "");
      if (startTime && new Date(startTime) < new Date(sinceIso)) continue; // safety filter vs. day-boundary re-fetch
      const rawName = c.customer_name ? String(c.customer_name).trim() : "";
      all.push({
        id: String(c.id),
        occurredAt: startTime,
        durationSec: Number(c.duration ?? 0),
        callerNumber: String(c.customer_phone_number ?? ""),
        callerName: rawName.length > 0 ? rawName : null,
        trackingNumber: String(c.tracking_phone_number ?? c.business_phone_number ?? ""),
        keypress: c.keypad_entries ? String(c.keypad_entries) : null,
        answered: !!c.answered,
        recordingUrl: c.recording ? String(c.recording) : null,
        raw: c,
      });
    }

    if (page >= (json.total_pages ?? 1)) break;
    page++;
    await new Promise((r) => setTimeout(r, 250));
  }

  return all;
}

export function isLsaLine(call: CallRailCall, config: CallRailConfig): boolean {
  return (config.lsaTrackingNumbers ?? []).includes(call.trackingNumber);
}

// Classification — Canencia's real setup (Alan, 2026-08-02). Timeline
// matters here: BEFORE today, Canencia had no call-screening menu at all —
// every call was forwarded straight to TalkRoute regardless of whether it
// was spam, so historical calls (all 7 in the account as of this writing)
// carry no reliable "was this real" signal. Alan added a press-a-key menu
// on the CallRail side TODAY — going forward, a caller must press a key to
// be forwarded on to TalkRoute at all, so keypad_entries being populated
// is the real signal once calls start flowing through the new menu (none
// have yet — it was just switched on). This restores the original
// keypress-based design; `answered` was a wrong turn based on a
// misreading of pre-menu historical data. Calls on a configured LSA line
// (none for Canencia — LSA bypasses CallRail entirely for this client) are
// always QUALIFIED regardless. Duration under 20s is flagged for review
// but never changes the classification and never auto-deletes.
export function classifyCall(call: CallRailCall, config: CallRailConfig): { classification: string; needsReview: boolean } {
  const classification = isLsaLine(call, config) ? "QUALIFIED" : call.keypress ? "QUALIFIED" : "ROBOCALL";
  return { classification, needsReview: call.durationSec < 20 };
}

// Fetches recording audio bytes server-side for the in-portal playback
// proxy — the API key never reaches the browser.
export async function fetchRecordingAudio(params: {
  apiKey: string;
  recordingUrl: string;
}): Promise<{ body: ReadableStream<Uint8Array> | null; contentType: string }> {
  const res = await fetch(params.recordingUrl, { headers: authHeader(params.apiKey) });
  if (!res.ok) throw new Error(`CallRail recording fetch failed: ${res.status}`);
  return { body: res.body, contentType: res.headers.get("content-type") ?? "audio/mpeg" };
}
