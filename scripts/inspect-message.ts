// Read-only diagnostic: fetch one Gmail message and print its headers +
// body so we can see exactly which fields identify the owning client.
// Used to design the cross-client attribution fix. Safe to delete.
import { google } from "googleapis";
import { prisma } from "../src/lib/prisma";
import { openJson } from "../src/lib/crypto";
import { clientFromRefreshToken } from "../src/lib/google-oauth";

async function main() {
  const messageId = process.argv[2];
  if (!messageId) throw new Error("usage: inspect-message.ts <gmailMessageId>");

  const integ = await prisma.clientIntegration.findFirstOrThrow({
    where: { provider: "GMAIL", status: "ACTIVE" },
    include: { client: true },
  });
  const { refreshToken } = openJson<{ refreshToken: string }>(integ.credentials);

  const gmail = google.gmail({ version: "v1", auth: clientFromRefreshToken(refreshToken) });
  const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const headers = res.data.payload?.headers ?? [];

  console.log("=== ALL HEADERS (routing-relevant first) ===");
  const interesting = ["from", "to", "delivered-to", "cc", "reply-to", "subject", "x-forwarded-to", "x-forwarded-for", "return-path", "envelope-to", "x-original-to", "list-id", "sender"];
  for (const name of interesting) {
    const h = headers.filter((x) => x.name?.toLowerCase() === name);
    for (const one of h) console.log(`${one.name}: ${one.value}`);
  }
  console.log(`\n(labels: ${JSON.stringify(res.data.labelIds)})`);
}

main().finally(() => prisma.$disconnect());
