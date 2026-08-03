// Loads Canencia's real starting data, from sources Alan supplied 2026-08-03.
// Idempotent — safe to re-run; every write is an upsert keyed on real
// identity (month, url, keyword), never on position.
import "dotenv/config";
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CLIENT_ID = "cmsbhlur60000ibgy4084d8fk";

// ---- Google Local Services Ads, from Alan's LSA dashboard screenshots ----
// NOTE: these supersede the figures in CANENCIA_PORTAL_HANDOFF.md §7, which
// were a mid-month snapshot (July there reads 293 / $22.11 / 1 lead; the
// month actually closed at 300 / $37.27 / 2 leads).
const LSA = [
  { month: "2026-05", impressions: 202, topRatePct: 99.39, absTopRatePct: 98.78, spendCents: 0, chargedLeads: 0 },
  { month: "2026-06", impressions: 336, topRatePct: 99.23, absTopRatePct: 99.23, spendCents: 3932, chargedLeads: 2 },
  { month: "2026-07", impressions: 300, topRatePct: 98.46, absTopRatePct: 89.23, spendCents: 3727, chargedLeads: 2 },
];

// ---- Service-area pages (Alan's list, 2026-08-03) ----
// Slugs follow oahuhousepainters.com/service-areas/{slug}. Indexed status is
// left false until Search Console tells us otherwise — never assumed.
const TOWNS = [
  "Ewa Beach", "Kapolei", "Waipahu", "Pearl City", "Makakilo",
  "Mililani", "Waikele", "Waipio", "Nanakuli", "Kaneohe",
  "Waianae", "Honolulu", "Wahiawa", "Aiea", "Kailua",
  "Halawa", "Royal Kunia", "East Honolulu", "Ocean Pointe", "Waimalu",
];

const slugify = (t: string) => t.toLowerCase().replace(/\s+/g, "-");

// ---- Ahrefs positions, from Alan's dashboard (3 Aug 2026 vs 3 Jul 2026) ----
// The "Change" columns were empty in his view, so prevPosition stays null
// rather than inventing a movement figure.
const KEYWORDS = [
  { keyword: "painters oahu", volume: 70, position: 6, url: "https://www.oahuhousepainters.com/" },
  { keyword: "house painters oahu", volume: 50, position: 5, url: "https://www.oahuhousepainters.com/" },
  { keyword: "painting companies oahu", volume: 50, position: 7, url: "https://www.oahuhousepainters.com/" },
];

// ---- The two things Alan actually needs from Bryan & Desiree ----
// (The mock's "photos from the Makakilo job" and "follow up with a specific
// quote" were placeholders — Alan asked for them to be dropped.)
const TASKS = [
  {
    title: "Send me any recent customer names for reviews",
    explanation:
      "Just a first name and mobile number for anyone happy with their job — recent or going back a while, it all counts. I do the asking and the follow-up. This is the single biggest thing holding your Google Maps ranking back right now.",
    urgency: "Highest priority",
    responseType: "TEXT",
    sortOrder: 1,
  },
  {
    title: "Take photos at every project, before and after",
    explanation:
      "A few before shots — one wide angle of the whole area, one closer up — then a few after shots the same way. Phone photos are perfectly fine, and there's no need to organise them. These go straight onto your Google profile, which is the second biggest thing that moves your ranking.",
    urgency: "Every job",
    responseType: "PHOTO",
    sortOrder: 2,
  },
];

async function main() {
  console.log("=== LSA monthly stats ===");
  for (const s of LSA) {
    await prisma.lsaMonthlyStat.upsert({
      where: { clientId_month: { clientId: CLIENT_ID, month: s.month } },
      create: { clientId: CLIENT_ID, ...s },
      update: s,
    });
    const cpl = s.chargedLeads > 0 ? `$${(s.spendCents / s.chargedLeads / 100).toFixed(2)}/lead` : "no charged leads";
    console.log(`  ${s.month}: ${s.impressions} impressions, $${(s.spendCents / 100).toFixed(2)}, ${s.chargedLeads} leads (${cpl})`);
  }

  console.log("\n=== Service-area pages ===");
  for (const town of TOWNS) {
    const url = `https://oahuhousepainters.com/service-areas/${slugify(town)}`;
    await prisma.sitePage.upsert({
      where: { clientId_url: { clientId: CLIENT_ID, url } },
      create: {
        clientId: CLIENT_ID,
        url,
        town,
        // No published date was supplied per-page; the campaign started in
        // April, so that's the honest floor rather than inventing dates.
        publishedAt: new Date("2026-04-15T00:00:00Z"),
        indexed: false,
      },
      update: { town },
    });
  }
  console.log(`  ${TOWNS.length} pages upserted (indexed status left false until Search Console confirms)`);

  console.log("\n=== Ahrefs keyword positions (2026-08) ===");
  for (const k of KEYWORDS) {
    await prisma.keywordRank.upsert({
      where: { clientId_month_keyword: { clientId: CLIENT_ID, month: "2026-08", keyword: k.keyword } },
      create: { clientId: CLIENT_ID, month: "2026-08", prevPosition: null, ...k },
      update: { volume: k.volume, position: k.position, url: k.url },
    });
    console.log(`  "${k.keyword}" — position ${k.position}, volume ${k.volume}`);
  }

  console.log("\n=== Documents ===");
  const agreementPath = "/Users/alanwoods/Desktop/Master Folder/Woods Ascension/Canencia Painting Plan.pdf";
  try {
    const bytes = readFileSync(agreementPath);
    const existing = await prisma.document.findFirst({
      where: { clientId: CLIENT_ID, fileName: "Canencia Painting Plan.pdf" },
    });
    if (existing) {
      console.log("  agreement already uploaded — left as-is");
    } else {
      await prisma.document.create({
        data: {
          clientId: CLIENT_ID,
          name: "Your growth plan — what we agreed in April",
          fileName: "Canencia Painting Plan.pdf",
          contentType: "application/pdf",
          data: new Uint8Array(bytes),
          note: "The plan we put together when we started working together.",
          docDate: new Date("2026-04-15T00:00:00Z"),
        },
      });
      console.log(`  uploaded agreement (${bytes.length} bytes)`);
    }
  } catch (err) {
    console.log("  SKIPPED agreement:", err instanceof Error ? err.message : String(err));
  }

  console.log("\n=== Client tasks ===");
  for (const t of TASKS) {
    const existing = await prisma.clientTask.findFirst({ where: { clientId: CLIENT_ID, title: t.title } });
    if (existing) {
      await prisma.clientTask.update({ where: { id: existing.id }, data: t });
    } else {
      await prisma.clientTask.create({ data: { clientId: CLIENT_ID, ...t } });
    }
    console.log(`  ${t.title}`);
  }

  console.log("\n=== Location ===");
  const loc = await prisma.clientLocation.findFirst({ where: { clientId: CLIENT_ID, isPrimary: true } });
  console.log(`  primary location: ${loc?.name ?? "(none)"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
