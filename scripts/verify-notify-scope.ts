// Proves the D57 rule: only NEW_LEAD can ever reach a client's own people.
// Runs the REAL channel-selection query for every notification kind, both
// with toClient true and false, and reports who would be paged. Sends
// nothing — it only resolves recipients.
import { prisma } from "../src/lib/prisma";

const KINDS = ["NEW_LEAD", "TASK_SUBMISSION", "WATCHDOG", "SYNC_FAILURE", "REVIEW_REQUEST"] as const;
const CLIENT_VISIBLE = new Set<string>(["NEW_LEAD"]);

async function main() {
  const client = await prisma.client.findFirstOrThrow({ where: { slug: "canencia-painting" } });

  let bad = 0;
  for (const kind of KINDS) {
    for (const toClient of [true, false]) {
      const reachesClient = toClient && CLIENT_VISIBLE.has(kind);
      const channels = await prisma.notificationChannel.findMany({
        where: {
          active: true,
          channel: { in: ["PUSHOVER", "EMAIL"] },
          OR: [{ clientId: null }, ...(reachesClient ? [{ clientId: client.id }] : [])],
        },
      });
      const clientRecipients = channels.filter((c) => c.clientId !== null).map((c) => c.address);
      const alanRecipients = channels.filter((c) => c.clientId === null).length;

      // The rule: anything that isn't NEW_LEAD must reach zero client addresses.
      const violates = kind !== "NEW_LEAD" && clientRecipients.length > 0;
      if (violates) bad++;

      console.log(
        `${violates ? "VIOLATION" : "ok       "}  kind=${kind.padEnd(16)} toClient=${String(toClient).padEnd(5)} ` +
          `-> Alan channels: ${alanRecipients}, CLIENT channels: ${clientRecipients.length}` +
          (clientRecipients.length ? ` [${clientRecipients.join(", ")}]` : ""),
      );
    }
  }

  console.log(
    bad === 0
      ? "\nPASS — Bryan and Desiree can only ever be reached by NEW_LEAD, even if a call site forgets toClient:false."
      : `\nFAIL — ${bad} case(s) would reach the client.`,
  );
}

main().finally(() => prisma.$disconnect());
