// Read-only: groups every TalkRoute VOICEMAIL by the address it was
// forwarded to, showing what each caller actually wanted. Two TalkRoute
// accounts forward to two different aliases of the same inbox, so this is
// what proves which alias belongs to which client. See D56.
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

  const list = await gmail.users.messages.list({ userId: "me", q: "from:voicemail@talkroute.com", maxResults: 100 });
  const ids = (list.data.messages ?? []).map((m) => m.id!);

  const groups = new Map<string, { date: string; caller: string; said: string }[]>();

  for (const id of ids) {
    const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const headers = res.data.payload?.headers ?? [];
    const h = (n: string) => headers.find((x) => x.name?.toLowerCase() === n)?.value ?? "";
    const to = (h("delivered-to") || h("to")).toLowerCase().trim();
    const text = walk(res.data.payload);
    const after = text.split(/Mailbox:[^\n]*\n/i)[1] ?? "";
    const said = after
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^https?:\/\//i.test(l) && !/talkroute/i.test(l) && !/^</.test(l))
      .join(" ")
      .replace(/&apos;/g, "'")
      .slice(0, 105);

    if (!groups.has(to)) groups.set(to, []);
    groups.get(to)!.push({
      date: new Date(Number(res.data.internalDate)).toISOString().slice(0, 10),
      caller: h("subject").replace(/You Have A New Voice Message From\s*/i, ""),
      said,
    });
  }

  for (const [to, items] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${"=".repeat(78)}`);
    console.log(`FORWARDED TO: ${to}   (${items.length} voicemail${items.length === 1 ? "" : "s"})`);
    console.log("=".repeat(78));
    for (const i of items.sort((a, b) => b.date.localeCompare(a.date))) {
      console.log(`  ${i.date}  ${i.caller}`);
      console.log(`     "${i.said}"`);
    }
  }
}

main().finally(() => prisma.$disconnect());
