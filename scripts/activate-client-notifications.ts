import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Switches Bryan and Desiree's notification channels on.
//
// They have been deliberately inactive since Phase 3 — Alan's instruction
// was that nothing reach them until he said so. This is that moment: he
// asked for all three of them to receive every lead. Alan's own channels
// are untouched; he keeps getting everything either way. See D49.
const SLUG = "canencia-painting";

async function main() {
  const client = await prisma.client.findUniqueOrThrow({ where: { slug: SLUG } });

  const before = await prisma.notificationChannel.findMany({
    where: { clientId: client.id },
    orderBy: { channel: "asc" },
  });
  console.log("Before:");
  for (const c of before) console.log(`  ${c.channel.padEnd(9)} ${c.address.padEnd(34)} ${c.active ? "ACTIVE" : "inactive"}`);

  const { count } = await prisma.notificationChannel.updateMany({
    where: { clientId: client.id, active: false },
    data: { active: true },
  });

  const after = await prisma.notificationChannel.findMany({
    where: { OR: [{ clientId: client.id }, { clientId: null }] },
    orderBy: [{ clientId: "asc" }, { channel: "asc" }],
  });
  console.log(`\nSwitched ${count} on. Everything that will now fire:`);
  for (const c of after) {
    console.log(`  ${c.channel.padEnd(9)} ${c.address.padEnd(34)} ${c.clientId ? "client" : "Alan  "}  ${c.active ? "ACTIVE" : "inactive"}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
