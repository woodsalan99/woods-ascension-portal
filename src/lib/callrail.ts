// CallRail v3 API wrapper — fetch/pagination conventions templated off
// src/lib/smartlead.ts. HONEST LIMITATION: built against CallRail's
// publicly documented v3 Calls API shape, not verified against a real
// account (none available yet). Field names below (customer_phone_number,
// tracking_phone_number, keypad_entries, recording, etc.) should be
// checked against Alan's actual CallRail account response once the API
// key is available — the sync route's raw Json column keeps the full
// original payload regardless, so nothing is lost if a field name is off,
// only mis-mapped until corrected.
const CALLRAIL_BASE = "https://api.callrail.com/v3";

export type CallRailCall = {
  id: string;
  occurredAt: string; // ISO
  durationSec: number;
  callerNumber: string;
  trackingNumber: string;
  keypress: string | null;
  answered: boolean;
  recordingUrl: string | null;
  raw: Record<string, unknown>;
};

export type CallRailConfig = {
  accountId: string;
  // Tracking numbers routed straight to the LSA line — these bypass the
  // IVR entirely and are always QUALIFIED (handoff §3.1/§8: "LSA-sourced
  // calls never pass through the IVR — routing configured in CallRail by
  // Alan; the sync respects the classification").
  lsaTrackingNumbers?: string[];
  cursor?: string; // ISO timestamp of the latest call synced so far
};

function authHeader(apiKey: string): Record<string, string> {
  return { Authorization: `Token token="${apiKey}"` };
}

// Pulls calls for an account since a given ISO timestamp, paginated.
export async function fetchCalls(params: { apiKey: string; accountId: string; sinceIso: string }): Promise<CallRailCall[]> {
  const { apiKey, accountId, sinceIso } = params;
  const all: CallRailCall[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = new URL(`${CALLRAIL_BASE}/a/${accountId}/calls.json`);
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
      all.push({
        id: String(c.id),
        occurredAt: startTime,
        durationSec: Number(c.duration ?? 0),
        callerNumber: String(c.customer_phone_number ?? ""),
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

// Classification per handoff §3.1: keypress present -> QUALIFIED; no
// keypress on the regular IVR line -> ROBOCALL; the LSA line bypasses the
// IVR entirely -> always QUALIFIED. Duration under 20s is flagged for
// review but never changes the classification and never auto-deletes.
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
