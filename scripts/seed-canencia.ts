// One-time setup for the first LOCAL_SERVICES client (Canencia Painting).
// Phase 1 scope only — just the Client row + its primary location, so the
// portal has a real LOCAL_SERVICES client to log into. Everything else
// (leads, rankings, tasks, ...) is seeded/synced in later phases.
// See IMPLEMENTATION_STATE.md §2 Sequence step 6.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const client = await prisma.client.upsert({
    where: { slug: "canencia-painting" },
    update: {},
    create: {
      name: "Canencia Painting",
      slug: "canencia-painting",
      timezone: "Pacific/Honolulu",
      status: "ACTIVE",
      type: "LOCAL_SERVICES",
      stageLabels: {},
      heroName: "Canencia Painting",
    },
  });

  await prisma.clientLocation.upsert({
    where: { id: `${client.id}-primary` },
    update: {},
    create: {
      id: `${client.id}-primary`,
      clientId: client.id,
      name: "Ewa Beach",
      isPrimary: true,
    },
  });

  console.log("Canencia client ready:", client.id, client.slug, client.type);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
