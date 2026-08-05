// Proves the D56 tenancy gate against the two REAL emails that exposed the
// leak: Canencia's own LSA call email, and the Pamalu voicemail that was
// wrongly announced to Bryan and Desiree.
import { google } from "googleapis";
import { prisma } from "../src/lib/prisma";
import { openJson } from "../src/lib/crypto";
import { clientFromRefreshToken } from "../src/lib/google-oauth";
import { lsaMatcher, formMatcher, talkrouteMatcher, type GmailMatcherConfig, type GmailMeta } from "../src/lib/gmail-parsers";

const ROUTING = ["to", "cc", "delivered-to", "x-forwarded-to", "x-forwarded-for", "x-original-to", "envelope-to"];

async function load(messageId: string, refreshToken: string): Promise<{ meta: GmailMeta; text: string }> {
  const gmail = google.gmail({ version: "v1", auth: clientFromRefreshToken(refreshToken) });
  const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const headers = res.data.payload?.headers ?? [];
  const h = (n: string) => headers.find((x) => x.name?.toLowerCase() === n)?.value ?? "";
  const recipients = headers
    .filter((x) => x.name && ROUTING.includes(x.name.toLowerCase()))
    .map((x) => x.value ?? "")
    .join(" ")
    .toLowerCase();
  const part = res.data.payload;
  const walk = (p: typeof part): string => {
    if (!p) return "";
    if (p.mimeType === "text/plain" && p.body?.data) return Buffer.from(p.body.data, "base64url").toString("utf8");
    for (const c of p.parts ?? []) { const t = walk(c); if (t) return t; }
    return "";
  };
  return {
    meta: { id: res.data.id!, internalDate: Number(res.data.internalDate), from: h("from"), subject: h("subject"), recipients },
    text: walk(part),
  };
}

async function main() {
  const integ = await prisma.clientIntegration.findFirstOrThrow({
    where: { provider: "GMAIL", status: "ACTIVE" },
  });
  const { refreshToken } = openJson<{ refreshToken: string }>(integ.credentials);
  const cfg = integ.config as GmailMatcherConfig;

  // Every real message we've ever turned into a lead or a form submission,
  // plus the known-bad one. A regression here would mean the tenancy gate
  // has started refusing mail that genuinely IS Canencia's.
  const leads = await prisma.serviceLead.findMany({
    where: { gmailMessageId: { not: null } },
    select: { gmailMessageId: true, source: true },
  });
  const forms = await prisma.formSubmission.findMany({ select: { gmailMessageId: true } });

  // EVERY voicemail in the inbox. Canencia's TalkRoute account forwards to
  // the +1 alias, the roofing client's to the plain address — so the
  // expected answer is decided by where it was routed, and any message
  // whose claim disagrees with its routing is a real bug.
  const gmailForList = google.gmail({ version: "v1", auth: clientFromRefreshToken(refreshToken) });
  const vmList = await gmailForList.users.messages.list({
    userId: "me",
    q: "from:voicemail@talkroute.com",
    maxResults: 100,
  });
  const voicemails = await Promise.all(
    (vmList.data.messages ?? []).map(async (m) => {
      const r = await gmailForList.users.messages.get({ userId: "me", id: m.id!, format: "metadata", metadataHeaders: ["Delivered-To", "To"] });
      const hs = r.data.payload?.headers ?? [];
      const to = (hs.find((x) => x.name?.toLowerCase() === "delivered-to")?.value ?? hs.find((x) => x.name?.toLowerCase() === "to")?.value ?? "").toLowerCase();
      return { label: `voicemail routed to ${to}`, id: m.id!, shouldBelong: to.includes("woodsalan99+1@gmail.com") };
    }),
  );

  const cases = [
    ...leads.map((l) => ({ label: `historical lead (${l.source})`, id: l.gmailMessageId!, shouldBelong: true })),
    ...forms.map((f) => ({ label: "historical form submission", id: f.gmailMessageId!, shouldBelong: true })),
    ...voicemails,
  ];

  console.log("Canencia config:", JSON.stringify({
    formFromAddress: cfg.formFromAddress,
    lsaToAddress: cfg.lsaToAddress ?? "(unset)",
    talkrouteMailbox: cfg.talkrouteMailbox ?? "(unset)",
    talkrouteToAddress: cfg.talkrouteToAddress ?? "(unset)",
  }, null, 2));
  console.log();

  let pass = true;
  let checked = 0;
  for (const c of cases) {
    let loaded;
    try {
      loaded = await load(c.id, refreshToken);
    } catch {
      console.log(`SKIP  ${c.label} (${c.id}) — no longer retrievable from Gmail`);
      continue;
    }
    const { meta, text } = loaded;
    checked++;
    const kind = lsaMatcher.matches(meta, cfg) ? lsaMatcher
      : talkrouteMatcher.matches(meta, cfg) ? talkrouteMatcher
      : formMatcher.matches(meta, cfg) ? formMatcher
      : null;
    const belongs = kind ? kind.belongsToClient(meta, { text }, cfg) : false;
    const ok = belongs === c.shouldBelong;
    if (!ok) pass = false;
    console.log(`${ok ? "PASS" : "FAIL"}  ${c.label}`);
    console.log(`      kind=${kind?.provider ?? "none"}  claimed=${belongs}  expected=${c.shouldBelong}  subject="${meta.subject.slice(0, 60)}"`);
  }
  console.log(`\n${checked} message(s) checked.`);
  console.log(pass ? "ALL PASS — every real Canencia message still claimed, the Pamalu one refused." : "FAILURES ABOVE.");
}

main().finally(() => prisma.$disconnect());
