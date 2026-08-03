import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// August's plan, drafted from what the portal can actually see: Halawa is the
// one town page Google still isn't showing; reviews are the single biggest
// lever on the map and outreach lapsed after June; exterior painting is the
// weakest of the five scanned keywords (11.3 average against 7.5 for
// interior); and the windward side is where the map is thinnest.
//
// Alan edits this on the admin page or in the recap builder before anyone
// reads it — this is a starting point, not a commitment he didn't make.
const SLUG = "canencia-painting";
const MONTH = "2026-08";

const PLAN = [
  "Get the Halawa page picked up by Google — it's the last of the 20 town pages still not showing",
  "Restart review outreach properly, and set up the request-and-reminder flow so it doesn't lapse again",
  "Six more town pages, weighted towards the windward side where the map is weakest",
  "Build internal links between the town pages so the stronger ones pull the weaker ones up",
  "Keep the Google ads exactly as they are — nothing needs changing while leads are under $20",
];

async function main() {
  const client = await prisma.client.findUniqueOrThrow({ where: { slug: SLUG } });
  const existing = await prisma.monthlyWork.findUnique({
    where: { clientId_month: { clientId: client.id, month: MONTH } },
  });

  await prisma.monthlyWork.upsert({
    where: { clientId_month: { clientId: client.id, month: MONTH } },
    create: { clientId: client.id, month: MONTH, items: [], nextMonth: PLAN },
    // Never clobber work items already logged for the month.
    update: { nextMonth: PLAN },
  });

  console.log(`${existing ? "updated" : "created"} ${MONTH} with ${PLAN.length} plan items`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
