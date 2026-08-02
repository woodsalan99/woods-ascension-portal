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

// Classification — settled by a real end-to-end test on 2026-08-02, after
// two wrong guesses. Alan called the tracked number, pressed 1, and was
// connected. What CallRail actually recorded:
//
//   pressed 1, connected  -> answered: true,  recording present
//   did not complete menu -> answered: false, recording absent
//   keypad_entries        -> null on BOTH, and on all 9 calls in the
//                            account. CallRail simply does not expose the
//                            keypress here.
//
// So keypad_entries is unusable (the earlier design keyed on it and would
// have filed Alan's successful test as a robocall). `answered` is the real
// signal, and it means exactly what the setup needs it to: the caller got
// through the menu AND the forwarded call was picked up at TalkRoute —
// "only calls that make it to TalkRoute get logged".
//
// Known gap, deliberately conservative: someone who presses 1 but is not
// picked up shows answered:false and is filed MISSED rather than becoming
// a lead. It is still stored and flagged for review, so nothing is lost
// from the record — but it will not raise a notification. Better than
// manufacturing lead cards for robocalls that hung up at the menu.
//
// Calls on a configured LSA line (none for Canencia — LSA bypasses
// CallRail entirely there) are always QUALIFIED regardless.
export function classifyCall(call: CallRailCall, config: CallRailConfig): { classification: string; needsReview: boolean } {
  if (isLsaLine(call, config)) return { classification: "QUALIFIED", needsReview: call.durationSec < 20 };
  if (call.answered) return { classification: "QUALIFIED", needsReview: call.durationSec < 20 };
  // Never answered: either a robot that hung up at the menu, or a real
  // person nobody picked up for. Flagged so it is reviewable either way.
  return { classification: "MISSED", needsReview: true };
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
