// Local Falcon scans, 2026-08-02. Five keywords, each a 9x9 grid over a
// 7-mile radius, keyword names confirmed by Alan.
//
// PROVENANCE: these cell values were read off the map images Alan sent —
// he has the visual exports, not the CSV/JSON. avgRank and top3Pct are
// computed from them here rather than typed in, so the stats always agree
// with the grid. "20+" in Local Falcon is stored as 20 (not visible).
// If exact exports turn up later, re-running this with real CSV data will
// simply overwrite these rows (unique on client+location+keyword+month).
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CLIENT_ID = "cmsbhlur60000ibgy4084d8fk";
const MONTH = "2026-08";
const TAKEN_AT = new Date("2026-08-02T00:00:00Z");

const SCANS: { keyword: string; cells: number[] }[] = [
  {
    keyword: "commercial painting",
    cells: [
      10, 14, 15, 16, 19, 17, 17, 17, 15,
       7, 14, 15, 16, 16, 16, 18, 17, 20,
       7, 12, 15, 18, 20, 19, 20, 19, 16,
       6,  5, 10, 13, 17, 18, 18, 20, 15,
       1,  1,  3,  3,  3,  4,  4, 10, 20,
       2,  2,  2,  2,  3,  2,  3, 13, 20,
       2,  2,  2,  1,  1,  2,  2, 12, 20,
       2,  2,  2,  1,  1,  1,  2, 11, 20,
       2,  4,  2,  2,  1,  1,  1, 10, 20,
    ],
  },
  {
    keyword: "exterior painting",
    cells: [
      14, 17, 19, 20, 20, 20, 20, 20, 17,
      12, 14, 20, 20, 20, 20, 20, 20, 20,
       9, 13, 17, 19, 20, 20, 20, 20, 20,
       7, 11, 10, 16, 18, 20, 20, 20, 20,
       1,  2,  3,  3,  7, 10, 14, 20, 20,
       1,  1,  1,  2,  5,  2,  5, 20, 20,
       2,  2,  1,  1,  1,  1,  2, 20, 20,
       3,  4,  2,  1,  1,  2,  2, 16, 20,
       4,  4,  2,  1,  1,  1,  1, 13, 20,
    ],
  },
  {
    keyword: "house painters near me",
    cells: [
      10, 12, 11, 10, 11, 12, 14, 13, 13,
       8, 10, 10, 11, 12, 14, 14, 14, 13,
       5,  8, 10, 12, 13, 13, 13, 13, 15,
       4,  4,  9, 11, 12, 12,  9, 13, 15,
       2,  3,  3,  3,  5,  8,  7, 11, 15,
       3,  2,  3,  3,  3,  4,  3, 11, 19,
       2,  2,  1,  1,  1,  1,  2, 11, 20,
       2,  2,  1,  1,  1,  1,  2,  9, 20,
       2,  2,  2,  1,  1,  1,  3,  9, 20,
    ],
  },
  {
    keyword: "interior painting",
    cells: [
       5,  6, 13, 14, 14, 14, 14, 13, 12,
       3,  9, 13, 15, 16, 15, 14, 13, 11,
       7,  6, 12, 12, 18, 16, 15, 14, 11,
       4,  6,  8,  8, 15, 16, 14, 15, 12,
       1,  1,  2,  3,  2,  4,  3,  9, 15,
       1,  1,  1,  1,  2,  1,  3, 11, 14,
       1,  1,  1,  1,  1,  1,  2, 11, 20,
       1,  1,  1,  1,  1,  1,  2, 10, 20,
       1,  2,  1,  1,  1,  1,  1,  7, 20,
    ],
  },
  {
    keyword: "painting contractors near me",
    cells: [
      12, 14, 18, 16, 17, 18, 19, 19, 19,
      11, 15, 15, 16, 17, 19, 14, 17, 20,
       9, 11, 15, 17, 20, 20, 20, 20, 20,
       6,  7, 10, 12, 19, 20, 20, 20, 20,
       2,  3,  3,  3,  6, 11, 10, 16, 20,
       2,  1,  2,  2,  4,  4,  6, 17, 20,
       2,  2,  1,  1,  1,  1,  2, 17, 20,
       2,  3,  2,  1,  1,  1,  2, 11, 20,
       3,  3,  2,  1,  1,  1,  3, 10, 20,
    ],
  },
];

async function main() {
  const location = await prisma.clientLocation.findFirstOrThrow({
    where: { clientId: CLIENT_ID, isPrimary: true },
  });

  for (const s of SCANS) {
    if (s.cells.length !== 81) throw new Error(`${s.keyword}: expected 81 cells, got ${s.cells.length}`);
    const avgRank = s.cells.reduce((a, b) => a + b, 0) / s.cells.length;
    const top3Pct = (s.cells.filter((c) => c <= 3).length / s.cells.length) * 100;

    await prisma.geogridScan.upsert({
      where: {
        clientId_locationId_keyword_month: {
          clientId: CLIENT_ID,
          locationId: location.id,
          keyword: s.keyword,
          month: MONTH,
        },
      },
      create: {
        clientId: CLIENT_ID,
        locationId: location.id,
        keyword: s.keyword,
        month: MONTH,
        gridJson: { rows: 9, cols: 9, cells: s.cells, radiusMiles: 7 },
        avgRank,
        top3Pct,
        takenAt: TAKEN_AT,
      },
      update: {
        gridJson: { rows: 9, cols: 9, cells: s.cells, radiusMiles: 7 },
        avgRank,
        top3Pct,
        takenAt: TAKEN_AT,
      },
    });

    console.log(
      `  ${s.keyword.padEnd(30)} avg ${avgRank.toFixed(1).padStart(4)}  |  top-3 ${top3Pct.toFixed(0).padStart(2)}%  (${s.cells.filter((c) => c <= 3).length}/81 spots)`,
    );
  }

  const blended = SCANS.reduce((sum, s) => sum + s.cells.reduce((a, b) => a + b, 0) / s.cells.length, 0) / SCANS.length;
  console.log(`\n  Blended average across all five keywords: ${blended.toFixed(1)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
