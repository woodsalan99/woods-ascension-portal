import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// The recaps implied all 20 town pages existed from May, which was wrong:
// six went up each month. Working back from 20 today, that means 2 were live
// before May and the run was 2 → 8 → 14 → 20.
//
// May's "Your 20 town pages" bullet was corrected in the same pass — leaving
// it would have had the same recap claim 20 pages in May and 6 new ones.
// See D51.
type Item = { title: string; detail?: string; date?: string };

const PAGES: Record<string, { title: string; detail: string }> = {
  "2026-05": {
    title: "6 new town pages published — 8 live now",
    detail: "Each one targets a different town, so you turn up for 'painter in ___' searches the ads never reach",
  },
  "2026-06": {
    title: "6 more town pages published — 14 live now",
    detail: "Widening the map month by month, rather than betting everything on one page",
  },
  "2026-07": {
    title: "6 more town pages published — all 20 live now",
    detail: "The full set is up. From here the work is getting Google to trust them",
  },
};

// May's old bullet said 20 pages existed. Replaced with the same search
// numbers, minus the false count.
const MAY_OLD_TITLE = "Your 20 town pages working away in the background";
const MAY_NEW = {
  title: "Your town pages working away in the background",
  detail: "Appeared in Google search 4,190 times this month, bringing 34 people to the site",
};

async function main() {
  const client = await prisma.client.findUniqueOrThrow({ where: { slug: "canencia-painting" } });

  for (const [month, pageItem] of Object.entries(PAGES)) {
    const row = await prisma.monthlyWork.findUniqueOrThrow({
      where: { clientId_month: { clientId: client.id, month } },
    });
    let items = ((row.items as Item[] | null) ?? []).map((i) =>
      i.title === MAY_OLD_TITLE ? MAY_NEW : i,
    );

    // Idempotent: re-running must not stack duplicate page bullets.
    items = items.filter((i) => !/town pages published/i.test(i.title));
    // Pages first — it's the thing that compounds, and it now leads the story.
    items = [pageItem, ...items];

    await prisma.monthlyWork.update({ where: { id: row.id }, data: { items } });
    console.log(`${month}:`);
    for (const i of items) console.log(`   • ${i.title}`);
    console.log();
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
