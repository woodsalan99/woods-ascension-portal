import Anthropic from "@anthropic-ai/sdk";

// Server-side spam classification for parsed website-form submissions
// (handoff §3.3). Haiku-class model, strict JSON out. The classifier only
// judges and explains — the THRESHOLD decision (definite spam vs. flagged
// for Alan's manual review) lives in the caller (sync-gmail route), per
// the handoff: "Low-confidence -> flag for Alan's review, don't silently
// bin." Spam is always logged, never deleted, regardless of verdict.
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You classify inbound website-contact-form messages for a home painting contractor in Hawaii. Decide whether this is a REAL homeowner asking about a painting job, or SPAM/junk that should never reach the business owner.

Spam signals — weigh these heavily:
- The message is PITCHING something TO the business (SEO services, marketing, lead generation, web design, "grow your business" offers) rather than asking the business for painting work.
- It addresses the business/domain itself ("Hi oahuhousepainters.com team", "To the owner of this website") rather than a real conversational message to a painter.
- It contains a "Reply YES" or similar automated opt-in call-to-action.
- The phone number looks patterned or fake (e.g. 555-0100, repeating/sequential digits, obviously placeholder).
- The location field is empty or nonsensical for an Oahu-area painting lead.

A real lead: a homeowner describing a room, a surface, a project, or asking for a quote/estimate, even briefly.

Respond with ONLY a JSON object, no other text: {"qualified": boolean, "confidence": number between 0 and 1, "reason": "one short sentence"}. qualified=true means it looks like a real lead.`;

export type SpamClassifyInput = {
  name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  message: string | null;
};

export type SpamVerdict = { qualified: boolean; confidence: number; reason: string };

export async function classifySpam(input: SpamClassifyInput): Promise<SpamVerdict> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const client = new Anthropic({ apiKey });

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(input) }],
  });

  const text = res.content.find((b) => b.type === "text")?.text ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Model didn't return strict JSON — never silently bin; treat as the
    // lowest possible confidence so the caller always flags it for review.
    return { qualified: false, confidence: 0, reason: "Classifier returned non-JSON output; flagged for manual review." };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).qualified !== "boolean" ||
    typeof (parsed as Record<string, unknown>).confidence !== "number" ||
    typeof (parsed as Record<string, unknown>).reason !== "string"
  ) {
    return { qualified: false, confidence: 0, reason: "Classifier returned an unexpected shape; flagged for manual review." };
  }

  const v = parsed as SpamVerdict;
  return { qualified: v.qualified, confidence: Math.max(0, Math.min(1, v.confidence)), reason: v.reason };
}
