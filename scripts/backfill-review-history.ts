import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Review history, reconstructed from what Google shows on the profile:
// "2 weeks ago", "7 weeks ago", "38 weeks ago" against today's total of 34.
//
// Working backwards from 34, each of those three arrivals is a step down:
//
//   before ~10 Nov 2025 ....... 31
//   ~10 Nov 2025 (38w ago) .... 32
//   ~15 Jun 2026  (7w ago) .... 33
//   ~20 Jul 2026  (2w ago) .... 34   ← matches the live count
//
// The dates are approximate by construction — Google reports these in whole
// weeks, so each is ±3 days. That's immaterial at month granularity, which
// is the only resolution anything reads them at. Rating has been 5.0
// throughout, per the live snapshot.
//
// A snapshot is written on the day the count CHANGED, not on month ends:
// the resolver asks for the latest snapshot before the end of a period, so
// step dates give correct answers for every window without inventing rows
// for days nobody measured. See D47.
const CLIENT_SLUG = "canencia-painting";
const RATING = 5;

const STEPS: { date: string; count: number; note: string }[] = [
  { date: "2025-11-10", count: 32, note: "38 weeks ago" },
  { date: "2026-06-15", count: 33, note: "7 weeks ago" },
  { date: "2026-07-20", count: 34, note: "2 weeks ago" },
];

async function main() {
  const client = await prisma.client.findUniqueOrThrow({ where: { slug: CLIENT_SLUG } });

  for (const step of STEPS) {
    const date = new Date(`${step.date}T00:00:00Z`);
    await prisma.reviewSnapshot.upsert({
      where: { clientId_date: { clientId: client.id, date } },
      create: { clientId: client.id, date, count: step.count, rating: RATING },
      update: { count: step.count, rating: RATING },
    });
    console.log(`  ${step.date}  ${step.count} reviews   (${step.note})`);
  }

  const all = await prisma.reviewSnapshot.findMany({
    where: { clientId: client.id },
    orderBy: { date: "asc" },
  });
  console.log(`\n${all.length} snapshots on file, ${all[0].date.toISOString().slice(0, 10)} → ${all[all.length - 1].date.toISOString().slice(0, 10)}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
