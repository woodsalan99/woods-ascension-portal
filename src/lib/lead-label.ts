// What to call a lead before anyone has put a name to it.
//
// A bare "Unknown Name" is useless — it's the same on every unnamed card, so
// a board with three of them gives you nothing to tell them apart by. The
// number is what the client actually recognises and can act on, so it wins;
// email next; the placeholder only when we genuinely have neither. See D44.
export function leadLabel(lead: { name?: string | null; phone?: string | null; email?: string | null }): string {
  return lead.name?.trim() || lead.phone?.trim() || lead.email?.trim() || "Unknown Name";
}

/** True when we're showing a stand-in rather than a real name. */
export function isPlaceholderLabel(lead: { name?: string | null }): boolean {
  return !lead.name?.trim();
}
