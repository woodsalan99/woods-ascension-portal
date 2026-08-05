// Read-only: dumps EVERY header + full body of the TalkRoute voicemails, so
// we can see whether anything at all distinguishes one client's from
// another's. Compares the two known 2026-08-04 voicemails: Pete (Canencia,
// 808-551-1196) and Ed (Pamalu, 805-896-3962).
import { google } from "googleapis";
import { prisma } from "../src/lib/prisma";
import { openJson } from "../src/lib/crypto";
import { clientFromRefreshToken } from "../src/lib/google-oauth";

function walk(p: any): string {
  if (!p) return "";
  if (p.mimeType === "text/plain" && p.body?.data) return Buffer.from(p.body.data, "base64url").toString("utf8");
  for (const c of p.parts ?? []) { const t = walk(c); if (t) return t; }
  return "";
}

async function main() {
  const integ = await prisma.clientIntegration.findFirstOrThrow({ where: { provider: "GMAIL", status: "ACTIVE" } });
  const { refreshToken } = openJson<{ refreshToken: string }>(integ.credentials);
  const gmail = google.gmail({ version: "v1", auth: clientFromRefreshToken(refreshToken) });

  const list = await gmail.users.messages.list({ userId: "me", q: "from:voicemail@talkroute.com", maxResults: 60 });
  const ids = (list.data.messages ?? []).map((m) => m.id!);

  // Collect every header key/value across all voicemails, so a per-account
  // field would show up as varying rather than constant.
  const headerValues = new Map<string, Set<string>>();
  const rows: { date: string; subject: string; id: string }[] = [];

  for (const id of ids) {
    const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const headers = res.data.payload?.headers ?? [];
    for (const h of headers) {
      const k = (h.name ?? "").toLowerCase();
      if (!headerValues.has(k)) headerValues.set(k, new Set());
      headerValues.get(k)!.add(h.value ?? "");
    }
    const h = (n: string) => headers.find((x) => x.name?.toLowerCase() === n)?.value ?? "";
    rows.push({ date: new Date(Number(res.data.internalDate)).toISOString().slice(0, 16), subject: h("subject"), id });
  }

  console.log(`=== ${ids.length} voicemail email(s) ===\n`);
  console.log("=== HEADERS THAT VARY between voicemails (a client discriminator would be here) ===");
  for (const [name, values] of headerValues) {
    if (values.size > 1 && !["subject", "date", "message-id", "received", "x-received", "arc-seal", "arc-message-signature", "arc-authentication-results", "dkim-signature", "x-google-smtp-source", "x-gm-message-state", "x-google-dkim-signature", "mime-version", "content-type", "x-gm-gg", "x-gm-features"].includes(name)) {
      console.log(`\n  ${name}  (${values.size} distinct)`);
      for (const v of [...values].slice(0, 6)) console.log(`     ${v.slice(0, 130)}`);
    }
  }

  console.log("\n\n=== FULL BODY of the two known 2026-08-04 voicemails ===");
  for (const want of ["551-1196", "896-3962"]) {
    const row = rows.find((r) => r.subject.includes(want));
    if (!row) { console.log(`\n--- ${want}: not found ---`); continue; }
    const res = await gmail.users.messages.get({ userId: "me", id: row.id, format: "full" });
    const hh = res.data.payload?.headers ?? [];
    const hv = (n: string) => hh.filter((x) => x.name?.toLowerCase() === n).map((x) => x.value).join(" | ");
    const text = walk(res.data.payload);
    console.log(`\n--- ${row.subject} (${row.date}) ---`);
    console.log(`   >>> To:           ${hv("to")}`);
    console.log(`   >>> Delivered-To: ${hv("delivered-to")}`);
    console.log(`   >>> Return-Path:  ${hv("return-path")}`);
    // Strip the long tracking URLs so the structure is readable.
    console.log(text.replace(/https?:\/\/\S+/g, "[link]").split("\n").filter((l) => l.trim()).join("\n").slice(0, 900));
  }
}

main().finally(() => prisma.$disconnect());
