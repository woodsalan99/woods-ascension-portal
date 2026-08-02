import type { LeadSource, Prisma, ServiceLead } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// One person, one lead card. Every inbound contact — a call, a text, a
// website form, an LSA request — is routed through recordContact(), which
// either attaches it to the existing lead for that person or creates a new
// one, and always writes a timeline entry either way.
//
// Matching, strongest signal first:
//   1. CallRail personId — CallRail's own cross-contact identity. Same
//      value across that person's calls AND texts. Most reliable.
//   2. Normalized phone — digits only, last 10 compared, so
//      "+19252024922", "925-202-4922" and "(925) 202-4922" all match.
//   3. Exact name (case/space-insensitive) — ONLY when neither side has a
//      conflicting phone number. Two different customers really can share
//      a name, so this never overrides contradicting phone evidence.

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;
  // Compare on the last 10 digits so a country code doesn't break matching.
  return digits.slice(-10);
}

export function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = raw.trim().replace(/\s+/g, " ").toLowerCase();
  return n.length > 0 ? n : null;
}

export type ContactIdentity = {
  personId?: string | null;
  phone?: string | null;
  name?: string | null;
};

export async function findExistingLead(
  clientId: string,
  identity: ContactIdentity,
): Promise<ServiceLead | null> {
  const phoneNormalized = normalizePhone(identity.phone);

  if (identity.personId) {
    const byPerson = await prisma.serviceLead.findFirst({
      where: { clientId, personId: identity.personId },
      orderBy: { receivedAt: "desc" },
    });
    if (byPerson) return byPerson;
  }

  if (phoneNormalized) {
    const byPhone = await prisma.serviceLead.findFirst({
      where: { clientId, phoneNormalized },
      orderBy: { receivedAt: "desc" },
    });
    if (byPhone) return byPhone;
  }

  const name = normalizeName(identity.name);
  // Deliberately skip name matching for the LSA placeholder — every LSA
  // request arrives as the literal "Potential Customer", so matching on it
  // would collapse every unrelated Google lead into a single card.
  if (name && name !== "potential customer") {
    const candidates = await prisma.serviceLead.findMany({
      where: { clientId, name: { not: null } },
      orderBy: { receivedAt: "desc" },
    });
    for (const c of candidates) {
      if (normalizeName(c.name) !== name) continue;
      // Names match — but only merge if the phones don't actively disagree.
      if (phoneNormalized && c.phoneNormalized && c.phoneNormalized !== phoneNormalized) continue;
      return c;
    }
  }

  return null;
}

export type ContactEvent = {
  /** Timeline entry type: CALL | TEXT | FORM | LSA_REQUEST | MISSED_CALL */
  type: string;
  /** Stable id of the source event, so re-syncing never duplicates history. */
  dedupeKey: string;
  occurredAt: Date;
  /** Human-readable one-liner shown on the lead's timeline. */
  summary: string;
  meta?: Prisma.InputJsonValue;
};

export type RecordContactResult = {
  lead: ServiceLead;
  /** False when this contact was merged onto an existing lead. */
  isNewLead: boolean;
  /** False when this exact event was already recorded (a re-sync). */
  isNewEvent: boolean;
};

/**
 * Routes one inbound contact to the right lead and logs it on the timeline.
 * `create` supplies the fields used only when a NEW lead is needed;
 * `enrich` supplies fields worth back-filling onto an EXISTING lead when
 * we've learned something we didn't previously know (e.g. a name or phone
 * number that was hidden on the first contact).
 */
export async function recordContact(params: {
  clientId: string;
  identity: ContactIdentity;
  event: ContactEvent;
  create: Omit<Prisma.ServiceLeadUncheckedCreateInput, "clientId">;
  enrich?: Partial<Pick<ServiceLead, "name" | "phone" | "email" | "location" | "serviceType" | "recordingUrl" | "callRailUrl" | "personId">>;
}): Promise<RecordContactResult> {
  const { clientId, identity, event, create, enrich } = params;
  const phoneNormalized = normalizePhone(identity.phone ?? create.phone);

  const existing = await findExistingLead(clientId, identity);

  let lead: ServiceLead;
  let isNewLead: boolean;

  if (existing) {
    // Back-fill only genuinely missing fields — never overwrite something
    // a human may have corrected by hand in the portal.
    const patch: Prisma.ServiceLeadUncheckedUpdateInput = {};
    if (enrich) {
      for (const [k, v] of Object.entries(enrich) as [keyof typeof enrich, string | null | undefined][]) {
        if (v && !existing[k]) (patch as Record<string, unknown>)[k] = v;
      }
    }
    if (phoneNormalized && !existing.phoneNormalized) patch.phoneNormalized = phoneNormalized;
    if (identity.personId && !existing.personId) patch.personId = identity.personId;

    lead = Object.keys(patch).length
      ? await prisma.serviceLead.update({ where: { id: existing.id }, data: patch })
      : existing;
    isNewLead = false;
  } else {
    lead = await prisma.serviceLead.create({
      data: { ...create, clientId, phoneNormalized, personId: identity.personId ?? null },
    });
    isNewLead = true;
  }

  // Timeline entry. dedupeKey is unique, so a re-sync of the same call or
  // text is a silent no-op rather than a duplicate history row.
  const alreadyLogged = await prisma.leadActivity.findUnique({ where: { dedupeKey: event.dedupeKey } });
  if (!alreadyLogged) {
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: event.type,
        dedupeKey: event.dedupeKey,
        occurredAt: event.occurredAt,
        meta: { summary: event.summary, ...(event.meta as object | undefined) } as Prisma.InputJsonValue,
      },
    });
  }

  return { lead, isNewLead, isNewEvent: !alreadyLogged };
}
