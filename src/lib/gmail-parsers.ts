// Pure parsing functions — no network/DB access — for the two Gmail-sourced
// lead types (handoff §3.2). Kept pure so they're testable against fixture
// email bodies without a live Gmail connection.
//
// HONEST LIMITATION on the LSA parser: the handoff describes the LSA
// notification email's CONTENT (name/location/service/message fields) but
// not a byte-exact sample. This parser is a best-effort labeled-field
// reader matching the described shape and common real-world Google LSA
// notification wording. It should be checked against one real forwarded
// LSA email before this goes live — the poison-message policy in the sync
// route means a mismatch never loses the email (it's stored with the raw
// body + a parse error for review), but the lead also won't parse
// correctly until this is validated. The website-form parser, by
// contrast, is built to the handoff's exact labeled-field spec and is
// verified against a fixture matching that spec.

export type GmailMeta = { id: string; internalDate: number; from: string; subject: string };
export type ParseOutcome<T> = { ok: true; data: T } | { ok: false; reason: string };

export type LsaParsed = {
  receivedAt: Date;
  name: string | null; // null = literal "Potential Customer" (Google hides it)
  location: string | null; // city
  serviceType: string | null;
  message: string | null;
};

export type FormParsed = {
  receivedAt: Date;
  name: string;
  phone: string;
  email: string;
  address: string; // full: street + city/state/zip
  city: string | null;
  message: string;
  page: string | null;
  site: string | null;
};

export type GmailMatcherConfig = {
  formFromAddress: string; // e.g. "noreply@oahuhousepainters.com" — client-specific, disambiguates senders
  siteDomain?: string;
};

export interface Matcher<T> {
  provider: "LSA" | "ESTIMATE_FORM";
  matches(meta: GmailMeta, cfg: GmailMatcherConfig): boolean;
  parse(body: { text: string }, meta: GmailMeta): ParseOutcome<T>;
}

function clean(s: string): string {
  return s.replace(/\r\n/g, "\n").trim();
}

// Extracts a labeled field's value: everything after `label` up to the
// start of the next known boundary marker (another label, or a footer line
// like "Submitted:") or end of text. `label` and `allLabels` are regex
// source fragments (alternation patterns), not literal strings — e.g.
// "WHAT THEY NEED|M[AE]SSAGE". A boundary only needs to START a line, not
// be the whole line, so footer lines like "Submitted: Aug 2, 2026 HST"
// correctly stop a preceding field's capture even though they carry more
// text after the marker.
function field(body: string, label: string, allLabels: string): string | null {
  const re = new RegExp(
    `^[ \\t]*(?:${label})[ \\t]*:?[ \\t]*\\n?([\\s\\S]*?)(?=^[ \\t]*(?:${allLabels})|$(?![\\s\\S]))`,
    "im",
  );
  const m = re.exec(body);
  const value = m?.[1]?.trim();
  return value && value.length > 0 ? value : null;
}

// ---- A. LSA notification emails ----
export const lsaMatcher: Matcher<LsaParsed> = {
  provider: "LSA",
  matches(meta) {
    return /Potential Customer.?s sent you a new request/i.test(meta.subject);
  },
  parse(body, meta) {
    const text = clean(body.text);
    const ALL = "Name|Location|Service(?: requested| type)?|Message|Details|Phone";

    const rawName = field(text, "Name", ALL);
    const name = !rawName || /^potential customer$/i.test(rawName) ? null : rawName;
    const location = field(text, "Location", ALL);
    const serviceType = field(text, "Service(?: requested| type)?", ALL);
    const message = field(text, "Message|Details", ALL);

    if (!location && !serviceType && !message && !rawName) {
      return { ok: false, reason: "no recognizable LSA fields found in body" };
    }

    return {
      ok: true,
      data: { receivedAt: new Date(meta.internalDate), name, location, serviceType, message },
    };
  },
};

// ---- B. Website estimate-request emails (Lovable site, current format) ----
export const formMatcher: Matcher<FormParsed> = {
  provider: "ESTIMATE_FORM",
  matches(meta, cfg) {
    return meta.from.toLowerCase().includes(cfg.formFromAddress.toLowerCase());
  },
  parse(body) {
    const text = clean(body.text);
    // "Submitted:" is a boundary marker too (not a field itself) so the
    // WHAT THEY NEED/message capture stops before the footer instead of
    // swallowing "Submitted:.../Page:.../Site:..." into the message text.
    const ALL = "NAME|PHONE|EMAIL|PROJECT ADDRESS|WHAT THEY NEED|M[AE]SSAGE|Submitted:";

    const name = field(text, "NAME", ALL);
    const phone = field(text, "PHONE", ALL);
    const email = field(text, "EMAIL", ALL);
    const addressBlock = field(text, "PROJECT ADDRESS", ALL);
    const message = field(text, "WHAT THEY NEED|M[AE]SSAGE", ALL);

    if (!name || !addressBlock) {
      return { ok: false, reason: "missing required field (NAME or PROJECT ADDRESS)" };
    }

    // Address is two lines: street, then "City, ST ZIP".
    const addressLines = addressBlock.split("\n").map((l) => l.trim()).filter(Boolean);
    const cityLine = addressLines.find((l) => /^.+,\s*[A-Z]{2},?\s*\d{5}/.test(l));
    const cityMatch = cityLine ? /^(.+),\s*([A-Z]{2}),?\s*(\d{5})/.exec(cityLine) : null;
    const city = cityMatch ? cityMatch[1].trim() : null;

    const submittedMatch = /Submitted:\s*(.+?)\s*HST/i.exec(text);
    // HST (Hawaii Standard Time) has no DST — always UTC-10, safe to hardcode.
    const receivedAt = submittedMatch
      ? new Date(`${submittedMatch[1].trim()} UTC-10`)
      : new Date();

    const pageMatch = /Page:\s*(.+)/i.exec(text);
    const siteMatch = /Site:\s*(.+)/i.exec(text);

    return {
      ok: true,
      data: {
        receivedAt: isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
        name,
        phone: phone ?? "",
        email: email ?? "",
        address: addressBlock.replace(/\n/g, " ").trim(),
        city,
        message: message ?? "",
        page: pageMatch?.[1]?.trim() ?? null,
        site: siteMatch?.[1]?.trim() ?? null,
      },
    };
  },
};
