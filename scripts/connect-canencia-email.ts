// One-time (idempotent) setup of the EMAIL notification channels used to
// forward parsed leads on as a clean summary.
//
// Alan's own channel is ACTIVE so forwarding can be verified end to end.
// Bryan's and Desiree's are created INACTIVE on purpose — Alan's standing
// instruction is that nothing reaches them yet. Flipping `active` to true
// on those two rows is the single switch that turns them on later.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CANENCIA_CLIENT_ID = "cmsbhlur60000ibgy4084d8fk";

const CHANNELS: { clientId: string | null; address: string; active: boolean; who: string }[] = [
  { clientId: null, address: "woodsalan99@gmail.com", active: true, who: "Alan (admin-wide)" },
  { clientId: CANENCIA_CLIENT_ID, address: "bryancan10@yahoo.com", active: false, who: "Bryan" },
  { clientId: CANENCIA_CLIENT_ID, address: "canencia.painting15@gmail.com", active: false, who: "Desiree" },
];

async function main() {
  for (const c of CHANNELS) {
    const existing = await prisma.notificationChannel.findFirst({
      where: { clientId: c.clientId, channel: "EMAIL", address: c.address },
    });
    if (existing) {
      console.log(`already present (left as-is, active=${existing.active}): ${c.who} <${c.address}>`);
      continue;
    }
    await prisma.notificationChannel.create({
      data: { clientId: c.clientId, channel: "EMAIL", address: c.address, active: c.active },
    });
    console.log(`created EMAIL channel active=${c.active}: ${c.who} <${c.address}>`);
  }

  const all = await prisma.notificationChannel.findMany({
    orderBy: [{ channel: "asc" }, { address: "asc" }],
    select: { channel: true, address: true, active: true, clientId: true },
  });
  console.log("\nAll notification channels:");
  for (const r of all) {
    console.log(`  ${r.active ? "ON " : "off"}  ${r.channel.padEnd(9)} ${r.address}  ${r.clientId ? "(Canencia)" : "(admin-wide)"}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
