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
        STAGE_2: "Appointment Booked",
        STAGE_3: "Appointment Held",
        STAGE_4: "Deal Closed",
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
        state: "DONE",
        sortOrder: 2,
      },
      {
        clientId: client.id,
        label: "Campaign launch",
        subLabel: "Day 22",
        state: "DONE",
        sortOrder: 3,
      },
      {
        clientId: client.id,
        label: "10 qualified appointments",
        state: "CURRENT",
        targetValue: 15,
        currentValue: 13,
        subLabel: "13 of 15",
        sortOrder: 4,
      },
      {
        clientId: client.id,
        label: "25 qualified appointments",
        state: "NEXT",
        targetValue: 25,
        sortOrder: 5,
      },
      {
        clientId: client.id,
        label: "Day 111 review — proof of concept & ROI evaluation",
        state: "NEXT",
        sortOrder: 6,
      },
    ],
  });

  await prisma.pipelineEntry.deleteMany({ where: { clientId: client.id } });
  await prisma.pipelineEntry.createMany({
    data: [
      {
        clientId: client.id,
        stage: "STAGE_1",
        contactName: "Karen Ibarra",
        company: "Ibarra Plumbing & Rooter",
        dealValue: 1_200_000,
        qualified: true,
      },
      {
        clientId: client.id,
        stage: "STAGE_2",
        contactName: "Doug Fenwick",
        company: "Fenwick Electrical Group",
        dealValue: 2_400_000,
        qualified: true,
        callDateTime: new Date("2026-07-15T17:00:00.000Z"),
        callStatus: "CONFIRMED",
      },
      {
        clientId: client.id,
        stage: "STAGE_3",
        contactName: "Marcus Webb",
        company: "Webb HVAC Solutions",
        dealValue: 1_800_000,
        qualified: true,
        callDateTime: new Date("2026-07-08T20:00:00.000Z"),
        callStatus: "HELD",
      },
      {
        clientId: client.id,
        stage: "STAGE_4",
        contactName: "Renata Cole",
        company: "Cole Roofing & Exteriors",
        dealValue: 3_100_000,
        qualified: true,
      },
    ],
  });

  await prisma.dailyStat.deleteMany({ where: { clientId: client.id } });
  const dayStats = [];
  const baseDate = new Date("2026-06-22T00:00:00.000Z");
  for (let i = 0; i < 18; i++) {
    const date = new Date(baseDate);
    date.setUTCDate(date.getUTCDate() + i);
    const sends = 180 + ((i * 7) % 40);
    const totalReplies = 6 + (i % 5);
    const positiveReplies = 1 + (i % 3);
    const bounces = i % 4;
    const apptsBooked = i === 5 || i === 11 || i === 16 ? 1 : 0;
    dayStats.push({
      clientId: client.id,
      date,
      sends,
      totalReplies,
      positiveReplies,
      bounces,
      apptsBooked,
    });
  }
  await prisma.dailyStat.createMany({ data: dayStats });

  await prisma.weeklyNote.deleteMany({ where: { clientId: client.id } });
  await prisma.weeklyNote.create({
    data: {
      clientId: client.id,
      weekOf: new Date("2026-06-22T00:00:00.000Z"),
      headline: "Week 6: momentum building toward 15 qualified appointments",
      body: "Solid week — messaging is converting well in the trades verticals and we've got three calls on the books for next week. Keep an eye on the pipeline board below.",
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
