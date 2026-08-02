// Pure parsing functions — no network/DB access — for the two Gmail-sourced
// lead types (handoff §3.2). Kept pure so they're testable against fixture
// email bodies without a live Gmail connection.
//
// BOTH PARSERS ARE NOW VERIFIED AGAINST REAL EMAILS from Alan's inbox
// (2026-08-02), replacing the earlier best-effort guesses. What the real
// mail actually looks like:
//
// LSA (all from `...@awexpress.google.com`, subject is always
// "Potential Customer's new request" — NOT the longer body phrase the
// first version of this matcher wrongly keyed on, which is why zero LSA
// leads were being captured). Two body shapes:
//   A) New request — dash-prefixed labels, value on the following line:
//        - Name          -> always the literal "Potential Customer"
//        - Location      -> city
//        - Service type  -> e.g. "Paint Indoors", "Cabinet Painting"
//        - Message       -> free text, may wrap across lines
//   B) Customer message — "Potential Customer sent you a message" followed
//      by free text. This is the customer REPLYING, and in practice it is
//      where their phone number arrives ("Thanks! It's 727-465-6542"), so
//      we pull any phone number out of it.
//
// Website form (from the site's noreply address): labels on their own line
// with the value below, a "----" rule before "What they need", and a
// "Phone" value that carries a duplicated `tel:` link Google/the form
// builder appends — both handled below.

export type GmailMeta = { id: string; internalDate: number; from: string; subject: string };
export type ParseOutcome<T> = { ok: true; data: T } | { ok: false; reason: string };

export type LsaParsed = {
  receivedAt: Date;
  name: string | null; // null = literal "Potential Customer" (Google hides it)
  location: string | null; // city
  serviceType: string | null;
  message: string | null;
  phone: string | null; // only ever present on the customer-message variant
  variant: "REQUEST" | "MESSAGE";
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

// Google strips tracking links into `<https://c.gle/...>` blocks all through
// the body; removing them first makes the real structure legible.
function stripLsaNoise(text: string): string {
  return text
    .replace(/<https?:\/\/[^>]*>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

// LSA labels are dash-prefixed on their own line, value on the following
// line(s): "- Location\nKailua". Stops at the next known label or the
// "To connect with this customer" footer.
function lsaField(body: string, label: string): string | null {
  const re = new RegExp(
    `^[ \\t]*-[ \\t]*(?:${label})[ \\t]*$\\n+([\\s\\S]*?)(?=^[ \\t]*-[ \\t]*(?:Name|Location|Service type|Message)[ \\t]*$|^[ \\t]*To connect with this customer|$(?![\\s\\S]))`,
    "im",
  );
  const value = re.exec(body)?.[1]?.trim();
  if (!value) return null;
  // Re-join lines Google wrapped mid-sentence.
  return value.replace(/\s*\n\s*/g, " ").trim();
}

const PHONE_RE = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

export const lsaMatcher: Matcher<LsaParsed> = {
  provider: "LSA",
  matches(meta) {
    // Sender domain is the stable signal; subject is a secondary check for
    // any future variant Google sends from a different address.
    return /awexpress\.google\.com/i.test(meta.from) || /potential customer/i.test(meta.subject);
  },
  parse(body, meta) {
    const text = stripLsaNoise(clean(body.text));
    // Gmail's own receipt time is authoritative. The body's "You received
    // this request on 07/31/2026 at 7:56 AM" is in the LSA account's
    // timezone, which isn't stated in the mail — not worth guessing at.
    const receivedAt = new Date(meta.internalDate);

    // Variant B — the customer replying, usually with their phone number.
    if (/sent you a message/i.test(text)) {
      const after = text.split(/sent you a message/i)[1] ?? "";
      const messageText = after
        .split(/To connect with this customer|Need help\?/i)[0]
        .replace(/\s*\n\s*/g, " ")
        .trim();
      return {
        ok: true,
        data: {
          receivedAt,
          name: null,
          location: null,
          serviceType: null,
          message: messageText || null,
          phone: PHONE_RE.exec(messageText)?.[0]?.trim() ?? null,
          variant: "MESSAGE",
        },
      };
    }

    // Variant A — a new structured request.
    const rawName = lsaField(text, "Name");
    const location = lsaField(text, "Location");
    const serviceType = lsaField(text, "Service type");
    const message = lsaField(text, "Message");

    if (!location && !serviceType && !message && !rawName) {
      return { ok: false, reason: "no recognizable LSA fields found in body" };
    }

    return {
      ok: true,
      data: {
        receivedAt,
        // Google hides the real name behind this literal until you reply.
        name: !rawName || /^potential customer$/i.test(rawName) ? null : rawName,
        location,
        serviceType,
        message,
        phone: null,
        variant: "REQUEST",
      },
    };
  },
};

// ---- B. Website estimate-request emails (Lovable site, current format) ----
export const formMatcher: Matcher<FormParsed> = {
  provider: "ESTIMATE_FORM",
  matches(meta, cfg) {
    // A client whose ClientIntegration.config hasn't been filled in yet
    // (formFromAddress unset) should just never match — not crash the
    // whole sync run for every other integration/message being processed
    // in the same batch.
    if (!cfg.formFromAddress) return false;
    return meta.from.toLowerCase().includes(cfg.formFromAddress.toLowerCase());
  },
  parse(body) {
    const text = clean(body.text);
    // Boundary markers, not all of them fields: "Submitted:" stops the
    // message capture before the footer, and the real mail puts a "-----"
    // rule between the address and "What they need" — without it as a
    // boundary the rule ends up glued onto the end of the address.
    const ALL = "NAME|PHONE|EMAIL|PROJECT ADDRESS|WHAT THEY NEED|M[AE]SSAGE|Submitted:|-{5,}";

    const name = field(text, "NAME", ALL);
    // Real mail renders the phone as "925-202-4922 tel:9252024922" — the
    // form builder appends a tel: link. Keep only the human-readable part,
    // otherwise it shows up mangled on the lead card and breaks tap-to-call.
    const phone = field(text, "PHONE", ALL)?.replace(/\s*tel:\S*/i, "").trim() ?? null;
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
