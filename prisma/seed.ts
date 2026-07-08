import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedZoom() {
  const client = await prisma.client.upsert({
    where: { slug: "zoom-business-brokers" },
    create: {
      name: "Zoom Business Brokers",
      slug: "zoom-business-brokers",
      timezone: "America/Los_Angeles",
      status: "ACTIVE",
      heroName: "Zoom Business Brokers",
      stageLabels: {
        STAGE_1: "Positive Reply",
        STAGE_2: "Appointment Booked",
        STAGE_3: "Appointment Held",
        STAGE_4: "Listing Signed",
      },
    },
    update: {},
  });

  await prisma.onboardingStep.deleteMany({ where: { clientId: client.id } });
  await prisma.onboardingStep.createMany({
    data: [
      {
        clientId: client.id,
        label: "Setup invoice paid",
        dayLabel: "Day 0",
        state: "DONE",
        sortOrder: 1,
      },
      {
        clientId: client.id,
        label: "Complete intake form",
        dayLabel: "Days 0–3",
        state: "CURRENT",
        sortOrder: 2,
      },
      {
        clientId: client.id,
        label: "Attend onboarding call",
        dayLabel: "Days 0–5",
        state: "NEXT",
        sortOrder: 3,
      },
      {
        clientId: client.id,
        label: "Provide best-fit seed companies",
        dayLabel: "Days 1–3",
        state: "NEXT",
        sortOrder: 4,
      },
      {
        clientId: client.id,
        label: "Record pre-call videos",
        dayLabel: "Days 1–7",
        state: "NEXT",
        sortOrder: 5,
      },
      {
        clientId: client.id,
        label: "Approve messaging scripts",
        dayLabel: "Days 4–10",
        state: "NEXT",
        sortOrder: 6,
      },
      {
        clientId: client.id,
        label: "Domains & inboxes provisioned, warmup running",
        dayLabel: "Days 1–21",
        state: "ACTIVE",
        sortOrder: 7,
      },
      {
        clientId: client.id,
        label: "Confirm calendar availability & integration",
        dayLabel: "Days 7–14",
        state: "NEXT",
        sortOrder: 8,
      },
      {
        clientId: client.id,
        label: "Campaign launch",
        dayLabel: "~Day 22",
        state: "NEXT",
        sortOrder: 9,
      },
    ],
  });

  await prisma.milestone.deleteMany({ where: { clientId: client.id } });
  await prisma.milestone.createMany({
    data: [
      {
        clientId: client.id,
        label: "Kickoff & setup",
        subLabel: "Day 0",
        state: "DONE",
        sortOrder: 1,
      },
      {
        clientId: client.id,
        label: "Infrastructure live & warming",
        subLabel: "Day 1",
        state: "CURRENT",
        sortOrder: 2,
      },
      {
        clientId: client.id,
        label: "Messaging approved",
        subLabel: "~Day 10",
        state: "NEXT",
        sortOrder: 3,
      },
      {
        clientId: client.id,
        label: "Campaign launch",
        subLabel: "~Day 22",
        state: "NEXT",
        sortOrder: 4,
      },
      {
        clientId: client.id,
        label: "First qualified appointments",
        subLabel: "Days 35–45",
        state: "NEXT",
        sortOrder: 5,
      },
      {
        clientId: client.id,
        label: "10 qualified appointments",
        state: "NEXT",
        targetValue: 10,
        sortOrder: 6,
      },
      {
        clientId: client.id,
        label: "25 qualified appointments",
        state: "NEXT",
        targetValue: 25,
        sortOrder: 7,
      },
      {
        clientId: client.id,
        label: "Day 111 review — proof of concept & ROI evaluation",
        state: "NEXT",
        sortOrder: 8,
      },
    ],
  });

  // Pipeline empty at launch per D14/§8.
  await prisma.pipelineEntry.deleteMany({ where: { clientId: client.id } });
  await prisma.dailyStat.deleteMany({ where: { clientId: client.id } });

  return client;
}

async function seedMeridian() {
  // NOTE: exact figures here are placeholders pending the approved demo
  // artifact (/design/demo-artifact.jsx, referenced in §9) — swap in the
  // real Week-6 numbers once that file is available. Structure (18 days
  // of stats, 4-stage pipeline, milestone 13/15 current) matches §8.
  const client = await prisma.client.upsert({
    where: { slug: "meridian-demo-co" },
    create: {
      name: "Meridian Demo Co.",
      slug: "meridian-demo-co",
      timezone: "America/New_York",
      status: "ACTIVE",
      heroName: "Meridian Demo Co.",
      stageLabels: {
        STAGE_1: "Positive Reply",
        STAGE_2: "Call Booked",
        STAGE_3: "Call Held",
        STAGE_4: "Closed",
      },
    },
    update: {},
  });

  await prisma.onboardingStep.deleteMany({ where: { clientId: client.id } });
  await prisma.onboardingStep.createMany({
    data: [
      {
        clientId: client.id,
        label: "Setup invoice paid",
        dayLabel: "Day 0",
        state: "DONE",
        sortOrder: 1,
      },
      {
        clientId: client.id,
        label: "Complete intake form",
        dayLabel: "Days 0–3",
        state: "DONE",
        sortOrder: 2,
      },
      {
        clientId: client.id,
        label: "Attend onboarding call",
        dayLabel: "Days 0–5",
        state: "DONE",
        sortOrder: 3,
      },
      {
        clientId: client.id,
        label: "Campaign launch",
        dayLabel: "~Day 22",
        state: "DONE",
        sortOrder: 4,
      },
    ],
  });

  // Milestones, pipeline, daily stats, and note below are lifted verbatim
  // (numbers, names, dates) from the approved demo artifact's Week-6
  // dataset — design/demo-artifact.jsx, W6_MILESTONES / PIPELINE_W6 /
  // W6_DAILY / CALLS_W6 — per §8's seed instruction for Meridian Demo Co.
  await prisma.milestone.deleteMany({ where: { clientId: client.id } });
  await prisma.milestone.createMany({
    data: [
      {
        clientId: client.id,
        label: "Campaign launch",
        subLabel: "Day 21",
        state: "DONE",
        sortOrder: 1,
      },
      {
        clientId: client.id,
        label: "First positive reply",
        subLabel: "Day 21",
        state: "DONE",
        sortOrder: 2,
      },
      {
        clientId: client.id,
        label: "First call booked",
        subLabel: "Day 23",
        state: "DONE",
        sortOrder: 3,
      },
      {
        clientId: client.id,
        label: "5 calls booked",
        subLabel: "Day 31",
        state: "DONE",
        sortOrder: 4,
      },
      {
        clientId: client.id,
        label: "First deal closed",
        subLabel: "Day 37",
        state: "DONE",
        sortOrder: 5,
      },
      {
        clientId: client.id,
        label: "15 calls booked",
        subLabel: "13 of 15",
        state: "CURRENT",
        targetValue: 15,
        currentValue: 13,
        sortOrder: 6,
      },
      {
        clientId: client.id,
        label: "25 calls booked",
        subLabel: "Next target",
        state: "NEXT",
        targetValue: 25,
        sortOrder: 7,
      },
    ],
  });

  await prisma.pipelineEntry.deleteMany({ where: { clientId: client.id } });
  await prisma.pipelineEntry.createMany({
    data: [
      {
        clientId: client.id,
        stage: "STAGE_1",
        contactName: "K. Morrison",
        company: "Morrison Hauling",
        notes: "Qualifying",
        qualified: true,
      },
      {
        clientId: client.id,
        stage: "STAGE_1",
        contactName: "P. Nguyen",
        company: "Nguyen Auto Group",
        notes: "Qualifying",
        qualified: true,
      },
      {
        clientId: client.id,
        stage: "STAGE_2",
        contactName: "Marcus Reyes",
        company: "Reyes Logistics",
        dealValue: 140_000,
        notes: "Fleet expansion",
        qualified: true,
        callDateTime: new Date("2026-07-09T19:00:00.000Z"), // Thu Jul 9, 3:00 PM EST
        callStatus: "CONFIRMED",
      },
      {
        clientId: client.id,
        stage: "STAGE_2",
        contactName: "Dana Whitfield",
        company: "Whitfield Dental",
        dealValue: 85_000,
        notes: "Equipment financing",
        qualified: true,
        callDateTime: new Date("2026-07-10T15:30:00.000Z"), // Fri Jul 10, 11:30 AM EST
        callStatus: "CONFIRMED",
      },
      {
        clientId: client.id,
        stage: "STAGE_2",
        contactName: "Sam Bhatt",
        company: "Bhatt Courier Group",
        dealValue: 110_000,
        notes: "Vehicle line",
        qualified: true,
        callDateTime: new Date("2026-07-13T18:00:00.000Z"), // Mon Jul 13, 2:00 PM EST
        callStatus: "PENDING",
      },
      {
        clientId: client.id,
        stage: "STAGE_3",
        contactName: "Tom Okafor",
        company: "Okafor Construction",
        dealValue: 220_000,
        qualified: true,
        callStatus: "HELD",
      },
      {
        clientId: client.id,
        stage: "STAGE_3",
        contactName: "Lisa Tran",
        company: "Tran Freight Co.",
        dealValue: 95_000,
        qualified: true,
        callStatus: "HELD",
      },
      {
        clientId: client.id,
        stage: "STAGE_4",
        contactName: "J. Alvarez",
        company: "Alvarez Towing",
        dealValue: 60_000,
        notes: "Funded",
        qualified: true,
      },
      {
        clientId: client.id,
        stage: "STAGE_4",
        contactName: "R. Castillo",
        company: "Castillo Paving",
        dealValue: 110_000,
        notes: "Funded",
        qualified: true,
      },
    ],
  });

  await prisma.dailyStat.deleteMany({ where: { clientId: client.id } });
  // d, sends, totalReplies (positive replies from artifact), bounces, apptsBooked
  const w6Daily: [string, number, number, number, number][] = [
    ["2026-06-15", 180, 1, 4, 0],
    ["2026-06-16", 220, 1, 5, 0],
    ["2026-06-17", 260, 2, 5, 1],
    ["2026-06-18", 300, 1, 6, 0],
    ["2026-06-19", 340, 3, 7, 0],
    ["2026-06-22", 420, 3, 8, 1],
    ["2026-06-23", 460, 4, 9, 0],
    ["2026-06-24", 500, 3, 9, 1],
    ["2026-06-25", 560, 5, 10, 1],
    ["2026-06-26", 600, 4, 11, 0],
    ["2026-06-29", 660, 6, 11, 1],
    ["2026-06-30", 700, 5, 12, 2],
    ["2026-07-01", 740, 6, 13, 1],
    ["2026-07-02", 800, 7, 13, 1],
    ["2026-07-03", 820, 6, 14, 0],
    ["2026-07-06", 860, 8, 15, 2],
    ["2026-07-07", 900, 7, 15, 1],
    ["2026-07-08", 640, 5, 10, 1],
  ];
  await prisma.dailyStat.createMany({
    data: w6Daily.map(([date, sends, positiveReplies, bounces, apptsBooked]) => ({
      clientId: client.id,
      date: new Date(`${date}T00:00:00.000Z`),
      sends,
      totalReplies: positiveReplies,
      positiveReplies,
      bounces,
      apptsBooked,
    })),
  });

  await prisma.weeklyNote.deleteMany({ where: { clientId: client.id } });
  await prisma.weeklyNote.create({
    data: {
      clientId: client.id,
      weekOf: new Date("2026-07-06T00:00:00.000Z"),
      headline: "Momentum is compounding.",
      body: "Two more calls booked this week and reply quality keeps improving as the data sharpens targeting. We're two calls away from the 15-call milestone — I expect to cross it before Friday. Watch for Reyes Logistics on Thursday; strongest fit we've seen so far.",
      published: true,
    },
  });

  return client;
}

async function main() {
  const zoom = await seedZoom();
  const meridian = await seedMeridian();
  console.log("Seeded clients:", zoom.slug, meridian.slug);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
