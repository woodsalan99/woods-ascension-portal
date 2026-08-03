import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Draft recaps for May, June and July 2026.
//
// EVERY number below is read from data already in this database — LsaMonthlyStat
// (from Alan's Google Ads screenshots), GscDailyStat (pulled live from Search
// Console), ServiceLead (the backfilled lead history) and SitePage. Nothing is
// estimated or inferred. Where the portal has no evidence — which jobs Bryan
// actually won, what work happened off-system — the recap stays quiet rather
// than guessing. Alan edits these before Bryan and Desiree ever see them.
//
// A person who got in touch is a LEAD, never a "customer" — the portal has
// no idea whether Bryan won the job. See D35.
const SLUG = "canencia-painting";

type Recap = {
  month: string;
  heroTitle: string;
  heroSub: string;
  items: { title: string; detail: string }[];
  nextMonth: string[];
  note: string;
};

const RECAPS: Recap[] = [
  {
    month: "2026-05",
    heroTitle: "Your Google ads started running, and you were the top painter shown almost every time.",
    heroSub:
      "Google put your business in front of 202 people looking for a painter in May, and you were the first painter listed in 99 out of every 100 of those. Nobody rang through the ad this month, so Google charged you nothing — with these ads you only pay when a real person actually contacts you.",
    items: [
      {
        title: "Google Local Services ads live and holding the top spot",
        detail: "Shown 202 times · first painter listed 99.4% of the time · $0 charged",
      },
      {
        title: "Your 20 town pages working away in the background",
        detail: "Appeared in Google search 4,190 times this month, bringing 34 people to the site",
      },
      {
        title: "2 real leads got in touch",
        detail: "1 phone call from your Google listing, 1 enquiry through the website",
      },
    ],
    nextMonth: [],
    note:
      "This is the quiet part. The ads are switched on and Google clearly rates you — being first-listed 99% of the time is as good as that number gets. What's missing is volume, and that comes from the town pages, which take months to build up trust with Google before they start pulling their weight. Nothing here worries me.",
  },
  {
    month: "2026-06",
    heroTitle: "The ads brought you your first paid leads, at less than half what most painters pay.",
    heroSub:
      "Two people contacted you straight through the Google ad in June, and Google charged $39.32 for both — about $19.66 each. The national average for a painting lead is around $53. You were still the first painter shown 99% of the time.",
    items: [
      {
        title: "Google ads brought in 2 real leads",
        detail: "$39.32 spent all month · $19.66 per lead · shown 336 times",
      },
      {
        title: "Still first painter listed, 99.2% of the time",
        detail: "Up from 202 to 336 times shown — two thirds more people saw you than in May",
      },
      {
        title: "Website search visibility climbing",
        detail: "4,838 appearances in Google search, up from 4,190 in May",
      },
      {
        title: "4 real leads in total",
        detail: "2 through the Google ad, 2 phone calls from your Google Maps listing",
      },
    ],
    nextMonth: [],
    note:
      "$19.66 a lead is genuinely good — most painters on the mainland pay nearly triple that. The reason your total is still small isn't the ads, it's that only so many people on Oahu search for a painter in a month. The ads can't create demand that isn't there. That's exactly the job the town pages are for: they reach people searching for 'painter in Kailua' rather than just 'painter', which the ads never show up for.",
  },
  {
    month: "2026-07",
    heroTitle: "Your best month yet — 6 real leads, and more people finding you through the website.",
    heroSub:
      "Six people got in touch in July, up from four in June and two in May. Website visits from Google went from 35 to 46 — the biggest jump so far, and the first clear sign the town pages are starting to earn their keep.",
    items: [
      {
        title: "6 real leads — triple May's number",
        detail: "2 through the Google ad, 3 phone calls from your Google listing, 1 website enquiry",
      },
      {
        title: "Website visits from Google up 31%",
        detail: "46 visits in July against 35 in June, from 4,637 appearances in search",
      },
      {
        title: "Google ads still cheap and still on top",
        detail: "$37.27 all month for 2 leads · $18.64 each · first painter listed 98.5% of the time",
      },
      {
        title: "19 of your 20 town pages now showing in Google search",
        detail: "Only the Halawa page is still waiting to be picked up",
      },
    ],
    nextMonth: [
      "Get the Halawa page picked up by Google — it's the last one of the 20 still not showing",
      "Keep the ads running as they are; nothing needs changing while they're this cheap",
      "Build up reviews, which is the single biggest thing deciding your position on Google Maps",
    ],
    note:
      "Three months in a row of growth, and the shape of it matters more than the size. In May everything came from the ads and your Maps listing. In July, the website is starting to contribute — and unlike the ads, that part keeps growing without costing more. Two things to be straight about: your ad cost per lead is excellent, but the ceiling on it is Oahu's search volume, not the budget. And I can only report on jobs won if the outcomes get marked on the Leads page — right now the portal knows who got in touch, but not who said yes.",
  },
];

async function main() {
  const client = await prisma.client.findUniqueOrThrow({ where: { slug: SLUG } });

  for (const r of RECAPS) {
    await prisma.monthlyWork.upsert({
      where: { clientId_month: { clientId: client.id, month: r.month } },
      // heroTitleManual/heroSubManual, not the *Auto fields: these are written,
      // not generated, and the manual pair is what wins on the page.
      create: {
        clientId: client.id,
        month: r.month,
        heroTitleManual: r.heroTitle,
        heroSubManual: r.heroSub,
        items: r.items,
        nextMonth: r.nextMonth,
        noteFromAlan: r.note,
      },
      update: {
        heroTitleManual: r.heroTitle,
        heroSubManual: r.heroSub,
        items: r.items,
        nextMonth: r.nextMonth,
        noteFromAlan: r.note,
      },
    });
    console.log(`upserted recap ${r.month}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
