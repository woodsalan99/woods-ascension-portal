// Attaches the real Local Falcon map exports to their GeogridScan rows.
// Uses the web-compressed webp versions (~28KB each) rather than the
// ~450KB PNG originals — see the storage note in the commit message.
import "dotenv/config";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CLIENT_ID = "cmsbhlur60000ibgy4084d8fk";
const MONTH = "2026-08";
const DIR =
  "/Users/alanwoods/Desktop/Master Folder/Woods Ascension/Client Portal/Canencia/Client Portal setup/web compressed versions of local falcon images";

// Filenames carry the keyword, e.g. "'house painters near me' 7mi radius
// 9x9.webp" — match on the quoted portion, case-insensitively, so the
// files stay the source of truth rather than a hardcoded order.
const MAX_BYTES = 60 * 1024;

function keywordFromFilename(file: string): string | null {
  const m = /'([^']+)'/.exec(file);
  return m ? m[1].trim().toLowerCase() : null;
}

async function main() {
  const files = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".webp"));
  const scans = await prisma.geogridScan.findMany({ where: { clientId: CLIENT_ID, month: MONTH } });

  let attached = 0;
  for (const file of files) {
    const keyword = keywordFromFilename(file);
    if (!keyword) {
      console.log(`  SKIP (no quoted keyword in filename): ${file}`);
      continue;
    }
    const scan = scans.find((s) => s.keyword.toLowerCase() === keyword);
    if (!scan) {
      console.log(`  SKIP (no scan row for "${keyword}"): ${file}`);
      continue;
    }

    const bytes = readFileSync(join(DIR, file));
    if (bytes.length > MAX_BYTES) {
      console.log(`  SKIP (${Math.round(bytes.length / 1024)}KB exceeds ${MAX_BYTES / 1024}KB cap): ${file}`);
      continue;
    }

    await prisma.geogridScan.update({
      where: { id: scan.id },
      data: { mapImage: new Uint8Array(bytes), mapImageType: "image/webp" },
    });
    console.log(`  ${scan.keyword.padEnd(30)} <- ${Math.round(bytes.length / 1024)}KB`);
    attached++;
  }

  const total = await prisma.geogridScan.count({ where: { clientId: CLIENT_ID, mapImage: { not: null } } });
  console.log(`\n  attached ${attached} image(s); ${total} scan(s) now have a map.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
