import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedZoom() {
  const zoomData = {
    name: "Zoom Business Brokers",
    timezone: "America/Los_Angeles",
    status: "ACTIVE",
    heroName: "Zoom Business Brokers",
    launchDate: new Date("2026-07-30T00:00:00.000Z"), // ~Day 22 per §8
    stageLabels: {
      STAGE_1: "Positive Reply",
      STAGE_2: "Appointment Booked",
      STAGE_3: "Appointment Held",
      STAGE_4: "Listing Signed",
    },
    domainsLive: 0,
    inboxesWarming: 0,
    warmupSends: 0,
  };
  const client = await prisma.client.upsert({
    where: { slug: "zoom-business-brokers" },
    create: { slug: "zoom-business-brokers", ...zoomData },
    update: zoomData,
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

  // Single default audience so the admin panel has something to assign
  // campaigns/pipeline entries to once real ones exist (v1.1, D19).
  await prisma.audienceDailyStat.deleteMany({
    where: { audience: { clientId: client.id } },
  });
  await prisma.campaign.updateMany({
    where: { clientId: client.id },
    data: { audienceId: null },
  });
  await prisma.pipelineEntry.updateMany({
    where: { clientId: client.id },
    data: { audienceId: null },
  });
  await prisma.audience.deleteMany({ where: { clientId: client.id } });
  await prisma.audience.create({
    data: { clientId: client.id, name: "Business Brokers", sortOrder: 1 },
  });

  return client;
}

async function seedMeridian() {
  // NOTE: exact figures here are placeholders pending the approved demo
  // artifact (/design/demo-artifact.jsx, referenced in §9) — swap in the
  // real Week-6 numbers once that file is available. Structure (18 days
  // of stats, 4-stage pipeline, milestone 13/15 current) matches §8.
  const meridianData = {
    name: "Meridian Demo Co.",
    timezone: "America/New_York",
    status: "ACTIVE",
    heroName: "Meridian Demo Co.",
    launchDate: new Date("2026-06-01T00:00:00.000Z"), // Day 21 launch, in the past — post-launch KPIs
    stageLabels: {
      STAGE_1: "Positive Reply",
      STAGE_2: "Call Booked",
      STAGE_3: "Call Held",
      STAGE_4: "Closed",
    },
  };
  const client = await prisma.client.upsert({
    where: { slug: "meridian-demo-co" },
    create: { slug: "meridian-demo-co", ...meridianData },
    update: meridianData,
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

  // Single audience for the demo, matching Alan's mockup ("Limo Campaign")
  // — v1.1 Audience concept (D19), see plan for schema rationale.
  await prisma.audienceDailyStat.deleteMany({
    where: { audience: { clientId: client.id } },
  });
  await prisma.campaign.updateMany({
    where: { clientId: client.id },
    data: { audienceId: null },
  });
  await prisma.audience.deleteMany({ where: { clientId: client.id } });
  const audience = await prisma.audience.create({
    data: { clientId: client.id, name: "Limo Campaign", sortOrder: 1 },
  });

  await prisma.pipelineEntry.createMany({
    data: [
      {
        clientId: client.id,
        audienceId: audience.id,
        stage: "STAGE_1",
        contactName: "K. Morrison",
        company: "Morrison Hauling",
        notes: "Qualifying",
        qualified: true,
      },
      {
        clientId: client.id,
        audienceId: audience.id,
        stage: "STAGE_1",
        contactName: "P. Nguyen",
        company: "Nguyen Auto Group",
        notes: "Qualifying",
        qualified: true,
      },
      {
        clientId: client.id,
        audienceId: audience.id,
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
        audienceId: audience.id,
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
        audienceId: audience.id,
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
        audienceId: audience.id,
        stage: "STAGE_3",
        contactName: "Tom Okafor",
        company: "Okafor Construction",
        dealValue: 220_000,
        qualified: true,
        callStatus: "HELD",
      },
      {
        clientId: client.id,
        audienceId: audience.id,
        stage: "STAGE_3",
        contactName: "Lisa Tran",
        company: "Tran Freight Co.",
        dealValue: 95_000,
        qualified: true,
        callStatus: "HELD",
      },
      {
        clientId: client.id,
        audienceId: audience.id,
        stage: "STAGE_4",
        contactName: "J. Alvarez",
        company: "Alvarez Towing",
        dealValue: 60_000,
        notes: "Funded",
        qualified: true,
      },
      {
        clientId: client.id,
        audienceId: audience.id,
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

  // Single audience for this demo, so AudienceDailyStat mirrors DailyStat.
  await prisma.audienceDailyStat.createMany({
    data: w6Daily.map(([date, sends, positiveReplies, bounces, apptsBooked]) => ({
      audienceId: audience.id,
      date: new Date(`${date}T00:00:00.000Z`),
      sends,
      totalReplies: positiveReplies,
      positiveReplies,
      bounces,
      apptsBooked,
    })),
  });

  await prisma.infrastructureItem.deleteMany({ where: { clientId: client.id } });
  await prisma.infrastructureItem.createMany({
    data: [
      { clientId: client.id, label: "Domains", quantity: 8, status: "ACTIVE", monthlyCost: 96, notes: "Sending domains for campaign", sortOrder: 1 },
      { clientId: client.id, label: "Inboxes", quantity: 24, status: "ACTIVE", monthlyCost: 288, notes: "Distributed across domains", sortOrder: 2 },
      { clientId: client.id, label: "Warmup / sending tool", quantity: 1, status: "ACTIVE", monthlyCost: 99, notes: "Smartlead + warmup", sortOrder: 3 },
      { clientId: client.id, label: "Lead data", quantity: 5000, status: "LOADED", monthlyCost: 125, notes: "Verified records for outreach", sortOrder: 4 },
      { clientId: client.id, label: "Email verification", quantity: 5000, status: "COMPLETE", monthlyCost: 42, notes: "Validation completed", sortOrder: 5 },
      { clientId: client.id, label: "Tracking / routing setup", quantity: 1, status: "COMPLETE", monthlyCost: 34, notes: "Calendar and attribution setup", sortOrder: 6 },
    ],
  });

  await prisma.metricConfig.deleteMany({ where: { clientId: client.id } });
  await prisma.metricConfig.createMany({
    data: [
      { clientId: client.id, metricKey: "EMAILS_SENT", cadence: "WEEKLY", targetMin: 5000, tips: ["More inboxes", "More verified leads"], sortOrder: 1 },
      { clientId: client.id, metricKey: "POSITIVE_REPLIES", cadence: "WEEKLY", targetMin: 50, tips: ["Better offer & messaging", "Highly clean & targeted list"], sortOrder: 2 },
      { clientId: client.id, metricKey: "QUALIFIED_APPTS", cadence: "WEEKLY", targetMin: 10, tips: ["Stronger qualification", "Better calendar conversion"], sortOrder: 3 },
      { clientId: client.id, metricKey: "POSITIVE_REPLY_RATE", cadence: "PERPETUAL", targetMin: 0.8, targetMax: 1.5, tips: ["Sharpen targeting", "Stronger first email"], sortOrder: 4 },
      { clientId: client.id, metricKey: "EMAILS_PER_BOOKED", cadence: "PERPETUAL", targetMax: 600, tips: ["Improve offer clarity", "Stronger follow-ups"], sortOrder: 5 },
      { clientId: client.id, metricKey: "EMAILS_PER_QUALIFIED", cadence: "PERPETUAL", targetMax: 800, tips: ["Better qualification", "Higher show rate"], sortOrder: 6 },
    ],
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

// Weekday-only date strings (YYYY-MM-DD) from `start` through `end`
// inclusive — cold-email sends realistically pause on weekends.
function businessDays(start: string, end: string): string[] {
  const days: string[] = [];
  const d = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  while (d <= endDate) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

// Sales-pitch demo clients (D23-era request): realistic-looking, steady-state
// (~2 months post-launch) sample accounts for showing prospects what the
// portal looks like mid-engagement. Not tied to any real Smartlead campaign
// — campaigns stay empty so the sync cron skips them entirely (see
// `if (client.campaigns.length === 0) continue` in the sync route) and this
// data is never overwritten by a real sync run.
async function seedLegacyGateAdvisors() {
  const data = {
    name: "Legacy Gate Advisors",
    timezone: "America/New_York",
    status: "ACTIVE",
    heroName: "Legacy Gate Advisors",
    onboardingDate: new Date("2026-05-18T00:00:00.000Z"),
    launchDate: new Date("2026-06-09T00:00:00.000Z"),
    calendarLink: "https://cal.com/legacygate/discovery-call",
    intakeFormLink: "https://forms.legacygate.com/intake",
    stageLabels: {
      STAGE_1: "Positive Reply",
      STAGE_2: "Appointment Booked",
      STAGE_3: "Appointment Held",
      STAGE_4: "Mandate Signed",
    },
  };
  const client = await prisma.client.upsert({
    where: { slug: "legacy-gate-advisors" },
    create: { slug: "legacy-gate-advisors", ...data },
    update: data,
  });

  // Reset children so this stays re-runnable.
  await prisma.pipelineCall.deleteMany({ where: { entry: { clientId: client.id } } });
  await prisma.pipelineEntry.deleteMany({ where: { clientId: client.id } });
  await prisma.audienceDailyStat.deleteMany({ where: { audience: { clientId: client.id } } });
  await prisma.audience.deleteMany({ where: { clientId: client.id } });
  await prisma.dailyStat.deleteMany({ where: { clientId: client.id } });
  await prisma.onboardingStep.deleteMany({ where: { clientId: client.id } });
  await prisma.milestone.deleteMany({ where: { clientId: client.id } });
  await prisma.infrastructureItem.deleteMany({ where: { clientId: client.id } });
  await prisma.metricConfig.deleteMany({ where: { clientId: client.id } });
  await prisma.weeklyNote.deleteMany({ where: { clientId: client.id } });
  await prisma.changelogEntry.deleteMany({ where: { clientId: client.id } });
  await prisma.internalNote.deleteMany({ where: { clientId: client.id } });
  await prisma.domain.deleteMany({ where: { clientId: client.id } });

  const sellSide = await prisma.audience.create({
    data: { clientId: client.id, name: "Sell-Side Owners", sortOrder: 1 },
  });
  const buySide = await prisma.audience.create({
    data: { clientId: client.id, name: "Search Funds & PE Buyers", sortOrder: 2 },
  });

  await prisma.onboardingStep.createMany({
    data: [
      { clientId: client.id, label: "Setup invoice paid", dayLabel: "Day 0", state: "DONE", sortOrder: 1 },
      { clientId: client.id, label: "Complete intake form", dayLabel: "Days 0–3", state: "DONE", sortOrder: 2 },
      {
        clientId: client.id,
        label: "Attend onboarding call",
        description:
          "45-minute kickoff covering target verticals (HVAC, manufacturing, specialty distribution), deal-size range, and how you like appointments qualified before they hit your calendar.",
        dayLabel: "Days 0–5",
        state: "DONE",
        sortOrder: 3,
      },
      { clientId: client.id, label: "Provide best-fit seed companies", dayLabel: "Days 1–3", state: "DONE", sortOrder: 4 },
      {
        clientId: client.id,
        label: "Domains & inboxes provisioned, warmup running",
        description:
          "6 sending domains across 18 inboxes, warmed for 3 weeks before the first real send to keep deliverability clean.",
        dayLabel: "Days 1–21",
        state: "DONE",
        sortOrder: 5,
      },
      { clientId: client.id, label: "Campaign launch", dayLabel: "Day 23", state: "DONE", sortOrder: 6 },
    ],
  });

  await prisma.milestone.createMany({
    data: [
      { clientId: client.id, label: "Campaign launch", subLabel: "Day 23", state: "DONE", sortOrder: 1 },
      { clientId: client.id, label: "First positive reply", subLabel: "Day 24", state: "DONE", sortOrder: 2 },
      { clientId: client.id, label: "First appointment booked", subLabel: "Day 27", state: "DONE", sortOrder: 3 },
      { clientId: client.id, label: "10 appointments booked", subLabel: "Day 41", state: "DONE", sortOrder: 4 },
      { clientId: client.id, label: "First mandate signed", subLabel: "Day 52", state: "DONE", sortOrder: 5 },
      {
        clientId: client.id,
        label: "20 appointments booked",
        subLabel: "18 of 20",
        state: "CURRENT",
        targetValue: 20,
        currentValue: 18,
        sortOrder: 6,
      },
      { clientId: client.id, label: "30 appointments booked", subLabel: "Next target", state: "NEXT", targetValue: 30, sortOrder: 7 },
    ],
  });

  type SeedEntry = {
    audience: typeof sellSide;
    stage: "STAGE_1" | "STAGE_2" | "STAGE_3" | "STAGE_4";
    contactName: string;
    company: string;
    dealValue?: number;
    notes?: string;
    qualified?: boolean;
    disqualifiedReason?: string;
    callStatus?: "CONFIRMED" | "PENDING" | "HELD" | "NO_SHOW";
    callDate?: string; // date-only
    callType?: "DISCOVERY" | "SALES";
    nextActionStep?: string;
  };

  const entries: SeedEntry[] = [
    // STAGE_1 — still qualifying
    { audience: sellSide, stage: "STAGE_1", contactName: "Renee Ashford", company: "Ashford HVAC Group", notes: "Qualifying" },
    { audience: sellSide, stage: "STAGE_1", contactName: "Doug Fenwick", company: "Fenwick Precision Machining", notes: "Qualifying" },
    { audience: buySide, stage: "STAGE_1", contactName: "Priya Nathan", company: "Nathan Search Partners", notes: "Qualifying" },
    { audience: sellSide, stage: "STAGE_1", contactName: "Carl Ubaldi", company: "Ubaldi Specialty Distribution", notes: "Qualifying" },

    // STAGE_2 — upcoming appointments
    {
      audience: sellSide, stage: "STAGE_2", contactName: "Marianne Costa", company: "Costa Roofing & Exteriors",
      dealValue: 220_000, notes: "Owner considering retirement, no succession plan", qualified: true,
      callStatus: "CONFIRMED", callDate: "2026-07-28", callType: "DISCOVERY", nextActionStep: "Send teaser + NDA before the call",
    },
    {
      audience: buySide, stage: "STAGE_2", contactName: "Trevor Lindqvist", company: "Lindqvist Capital Partners",
      dealValue: 180_000, notes: "Search fund, actively deploying", qualified: true,
      callStatus: "CONFIRMED", callDate: "2026-07-30", callType: "DISCOVERY", nextActionStep: "Confirm mandate fit against their thesis doc",
    },
    {
      audience: sellSide, stage: "STAGE_2", contactName: "Yolanda Pierce", company: "Pierce Industrial Coatings",
      dealValue: 300_000, notes: "Two competing offers already on the table", qualified: true,
      callStatus: "PENDING", callDate: "2026-08-04", callType: "DISCOVERY", nextActionStep: "Prep valuation comps before the call",
    },

    // STAGE_3 — held appointments (includes the realistic wrinkles)
    {
      audience: sellSide, stage: "STAGE_3", contactName: "Howard Ziegler", company: "Ziegler Metal Fabrication",
      dealValue: 260_000, qualified: true, callStatus: "HELD", callDate: "2026-07-08", callType: "DISCOVERY",
      nextActionStep: "Send engagement letter for signature",
    },
    {
      audience: sellSide, stage: "STAGE_3", contactName: "Alicia Monteverde", company: "Monteverde Dental Group",
      dealValue: 190_000, qualified: true, callStatus: "HELD", callDate: "2026-07-14", callType: "SALES",
      nextActionStep: "Follow up with revised fee structure",
    },
    {
      audience: buySide, stage: "STAGE_3", contactName: "Neil Okonkwo", company: "Okonkwo Growth Equity",
      dealValue: 150_000, qualified: true, callStatus: "HELD", callDate: "2026-07-16", callType: "DISCOVERY",
      nextActionStep: "Share 3 active sell-side mandates matching their range",
    },
    {
      // realistic wrinkle #1 — a no-show
      audience: sellSide, stage: "STAGE_3", contactName: "Buddy Larkspur", company: "Larkspur Logistics",
      qualified: false, callStatus: "NO_SHOW", callDate: "2026-07-11", callType: "DISCOVERY",
      nextActionStep: "One more reschedule attempt, then release the slot",
    },
    {
      // realistic wrinkle #2 — held but disqualified
      audience: sellSide, stage: "STAGE_3", contactName: "Everett Coombs", company: "Coombs Auto Parts Supply",
      qualified: false, disqualifiedReason: "Revenue below our minimum mandate size", callStatus: "HELD", callDate: "2026-07-17", callType: "DISCOVERY",
    },

    // STAGE_4 — closed
    {
      audience: sellSide, stage: "STAGE_4", contactName: "Rosalind Krantz", company: "Krantz Precision Tooling",
      dealValue: 240_000, notes: "Mandate signed, kicking off marketing process", qualified: true,
    },
    {
      audience: sellSide, stage: "STAGE_4", contactName: "Gus Palladino", company: "Palladino Waste Solutions",
      dealValue: 275_000, notes: "Mandate signed", qualified: true,
    },
    {
      audience: buySide, stage: "STAGE_4", contactName: "Whitney Sarno", company: "Sarno Family Office",
      dealValue: 210_000, notes: "Retained as buy-side advisor for a 3-deal search", qualified: true,
    },
  ];

  const positiveReplyBase = new Date("2026-06-10T00:00:00.000Z").getTime();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    await prisma.pipelineEntry.create({
      data: {
        clientId: client.id,
        audienceId: e.audience.id,
        stage: e.stage,
        contactName: e.contactName,
        company: e.company,
        dealValue: e.dealValue ?? null,
        notes: e.notes ?? null,
        qualified: e.qualified ?? true,
        disqualifiedReason: e.disqualifiedReason ?? null,
        nextActionStep: e.nextActionStep ?? null,
        positiveReplyDate: new Date(positiveReplyBase + i * 36 * 3_600_000),
        callDateTime: e.callDate ? new Date(`${e.callDate}T00:00:00.000Z`) : null,
        callStatus: e.callStatus ?? null,
        calls: e.callDate
          ? { create: { type: e.callType ?? "DISCOVERY", date: new Date(`${e.callDate}T00:00:00.000Z`) } }
          : undefined,
      },
    });
  }

  // ~2 months of weekday send history with a steady ramp, split ~60/40
  // across the two audiences.
  const days = businessDays("2026-06-09", "2026-07-23");
  const dailyRows = days.map((date, i) => {
    const sends = Math.round(160 + i * 6.5);
    const totalReplies = Math.round(sends * (0.05 + Math.sin(i / 5) * 0.01));
    const positiveReplies = Math.round(totalReplies * 0.28);
    const bounces = Math.round(sends * 0.012);
    return { date, sends, totalReplies, positiveReplies, bounces };
  });
  await prisma.dailyStat.createMany({
    data: dailyRows.map((r) => ({
      clientId: client.id,
      date: new Date(`${r.date}T00:00:00.000Z`),
      sends: r.sends,
      totalReplies: r.totalReplies,
      positiveReplies: r.positiveReplies,
      bounces: r.bounces,
    })),
  });
  await prisma.audienceDailyStat.createMany({
    data: dailyRows.flatMap((r) => [
      {
        audienceId: sellSide.id,
        date: new Date(`${r.date}T00:00:00.000Z`),
        sends: Math.round(r.sends * 0.6),
        totalReplies: Math.round(r.totalReplies * 0.6),
        positiveReplies: Math.round(r.positiveReplies * 0.6),
        bounces: Math.round(r.bounces * 0.6),
      },
      {
        audienceId: buySide.id,
        date: new Date(`${r.date}T00:00:00.000Z`),
        sends: r.sends - Math.round(r.sends * 0.6),
        totalReplies: r.totalReplies - Math.round(r.totalReplies * 0.6),
        positiveReplies: r.positiveReplies - Math.round(r.positiveReplies * 0.6),
        bounces: r.bounces - Math.round(r.bounces * 0.6),
      },
    ]),
  });

  await prisma.infrastructureItem.createMany({
    data: [
      { clientId: client.id, label: "Domains", quantity: 6, status: "ACTIVE", monthlyCost: 72, notes: "Sending domains for campaign", sortOrder: 1 },
      { clientId: client.id, label: "Inboxes", quantity: 18, status: "ACTIVE", monthlyCost: 216, notes: "Distributed across domains", sortOrder: 2 },
      { clientId: client.id, label: "Warmup / sending tool", quantity: 1, status: "ACTIVE", monthlyCost: 99, notes: "Smartlead + warmup", sortOrder: 3 },
      { clientId: client.id, label: "Lead data", quantity: 3000, status: "LOADED", monthlyCost: 175, notes: "Owner-operator business list, verified", sortOrder: 4 },
      { clientId: client.id, label: "Email verification", quantity: 3000, status: "COMPLETE", monthlyCost: 30, notes: "Validation completed", sortOrder: 5 },
      { clientId: client.id, label: "Tracking / routing setup", quantity: 1, status: "COMPLETE", monthlyCost: 34, notes: "Calendar and attribution setup", sortOrder: 6 },
    ],
  });

  await prisma.metricConfig.createMany({
    data: [
      { clientId: client.id, metricKey: "EMAILS_SENT", cadence: "WEEKLY", targetMin: 1800, tips: ["More inboxes", "Expand seed list"], sortOrder: 1 },
      { clientId: client.id, metricKey: "POSITIVE_REPLIES", cadence: "WEEKLY", targetMin: 12, tips: ["Sharpen the opener", "Tighter vertical targeting"], sortOrder: 2 },
      { clientId: client.id, metricKey: "QUALIFIED_APPTS", cadence: "WEEKLY", targetMin: 3, tips: ["Stronger pre-call qualification", "Faster follow-up on replies"], sortOrder: 3 },
      { clientId: client.id, metricKey: "POSITIVE_REPLY_RATE", cadence: "PERPETUAL", targetMin: 25, targetMax: 40, tips: ["Sharpen targeting", "Stronger first email"], sortOrder: 4 },
      { clientId: client.id, metricKey: "EMAILS_PER_BOOKED", cadence: "PERPETUAL", targetMax: 550, tips: ["Improve offer clarity", "Better calendar conversion"], sortOrder: 5 },
      { clientId: client.id, metricKey: "EMAILS_PER_QUALIFIED", cadence: "PERPETUAL", targetMax: 750, tips: ["Better qualification criteria", "Higher show rate"], sortOrder: 6 },
    ],
  });

  await prisma.weeklyNote.create({
    data: {
      clientId: client.id,
      weekOf: new Date("2026-07-20T00:00:00.000Z"),
      headline: "Two mandates in the last three weeks — momentum is real.",
      body:
        "Ziegler and Monteverde both moved to signed mandates, and Pierce Industrial has two competing offers already before we've even had the first call — that's the kind of seller we want more of. I'm tightening the opener this week to lean harder into the 'no obligation valuation' angle since that's what's converting best. Watch for Costa Roofing on the 28th — strong fit, no succession plan in place.",
      published: true,
    },
  });

  await prisma.changelogEntry.createMany({
    data: [
      { clientId: client.id, date: new Date("2026-06-20T00:00:00.000Z"), title: "Refreshed opening line based on reply data", body: "Leaned into the 'no obligation valuation' framing after it outperformed the original opener 2:1 in early replies." },
      { clientId: client.id, date: new Date("2026-07-01T00:00:00.000Z"), title: "Added 2 sending domains", body: "Volume was outgrowing our original domain count without hurting deliverability, so added headroom ahead of the July push." },
      { clientId: client.id, date: new Date("2026-07-15T00:00:00.000Z"), title: "Excluded sub-$3M revenue businesses from targeting", body: "Below our practical mandate minimum — narrowing the list should lift both reply quality and show rate." },
    ],
  });

  await prisma.internalNote.createMany({
    data: [
      { clientId: client.id, date: new Date("2026-07-05T00:00:00.000Z"), title: "Check-in call", body: "Client happy with pace but wants faster turnaround on scheduling — moving to same-day confirmations." },
      { clientId: client.id, date: new Date("2026-07-17T00:00:00.000Z"), title: "Coombs disqualification", body: "Confirmed with client directly — below minimum mandate size, fine to release from pipeline after this cycle." },
    ],
  });

  await prisma.domain.createMany({
    data: [
      { domain: "legacygate-outreach.com", clientId: client.id, coldStartDate: new Date("2026-05-19T00:00:00.000Z"), note: "Primary sending domain" },
      { domain: "legacygate-mail.com", clientId: client.id, coldStartDate: new Date("2026-05-19T00:00:00.000Z"), note: "Secondary sending domain" },
      { domain: "legacygate-connect.com", clientId: client.id, coldStartDate: new Date("2026-06-25T00:00:00.000Z"), note: "Added for July volume increase" },
      { domain: "legacygate-reach.com", clientId: client.id, coldStartDate: new Date("2026-05-19T00:00:00.000Z"), burnedAt: new Date("2026-07-02T00:00:00.000Z"), note: "Retired after reply-rate drop, replaced by legacygate-connect.com" },
    ],
  });

  return client;
}

async function seedAutoFundingCorp() {
  const data = {
    name: "Auto Funding Corp",
    timezone: "America/Chicago",
    status: "ACTIVE",
    heroName: "Auto Funding Corp",
    onboardingDate: new Date("2026-05-25T00:00:00.000Z"),
    launchDate: new Date("2026-06-16T00:00:00.000Z"),
    calendarLink: "https://cal.com/autofundingcorp/partner-call",
    intakeFormLink: "https://forms.autofundingcorp.com/intake",
    stageLabels: {
      STAGE_1: "Positive Reply",
      STAGE_2: "Appointment Booked",
      STAGE_3: "Appointment Held",
      STAGE_4: "Program Signed",
    },
  };
  const client = await prisma.client.upsert({
    where: { slug: "auto-funding-corp" },
    create: { slug: "auto-funding-corp", ...data },
    update: data,
  });

  await prisma.pipelineCall.deleteMany({ where: { entry: { clientId: client.id } } });
  await prisma.pipelineEntry.deleteMany({ where: { clientId: client.id } });
  await prisma.audienceDailyStat.deleteMany({ where: { audience: { clientId: client.id } } });
  await prisma.audience.deleteMany({ where: { clientId: client.id } });
  await prisma.dailyStat.deleteMany({ where: { clientId: client.id } });
  await prisma.onboardingStep.deleteMany({ where: { clientId: client.id } });
  await prisma.milestone.deleteMany({ where: { clientId: client.id } });
  await prisma.infrastructureItem.deleteMany({ where: { clientId: client.id } });
  await prisma.metricConfig.deleteMany({ where: { clientId: client.id } });
  await prisma.weeklyNote.deleteMany({ where: { clientId: client.id } });
  await prisma.changelogEntry.deleteMany({ where: { clientId: client.id } });
  await prisma.internalNote.deleteMany({ where: { clientId: client.id } });
  await prisma.domain.deleteMany({ where: { clientId: client.id } });

  const dealers = await prisma.audience.create({
    data: { clientId: client.id, name: "Independent Dealers", sortOrder: 1 },
  });
  const bhph = await prisma.audience.create({
    data: { clientId: client.id, name: "BHPH Lot Owners", sortOrder: 2 },
  });

  await prisma.onboardingStep.createMany({
    data: [
      { clientId: client.id, label: "Setup invoice paid", dayLabel: "Day 0", state: "DONE", sortOrder: 1 },
      { clientId: client.id, label: "Complete intake form", dayLabel: "Days 0–3", state: "DONE", sortOrder: 2 },
      {
        clientId: client.id,
        label: "Attend onboarding call",
        description:
          "Covered target regions, minimum deal size for a financing program, and how fast the underwriting team can turn around a same-week decision.",
        dayLabel: "Days 0–5",
        state: "DONE",
        sortOrder: 3,
      },
      { clientId: client.id, label: "Provide best-fit seed companies", dayLabel: "Days 1–3", state: "DONE", sortOrder: 4 },
      {
        clientId: client.id,
        label: "Domains & inboxes provisioned, warmup running",
        description: "8 sending domains across 24 inboxes, 3-week warmup before launch.",
        dayLabel: "Days 1–21",
        state: "DONE",
        sortOrder: 5,
      },
      { clientId: client.id, label: "Campaign launch", dayLabel: "Day 23", state: "DONE", sortOrder: 6 },
    ],
  });

  await prisma.milestone.createMany({
    data: [
      { clientId: client.id, label: "Campaign launch", subLabel: "Day 23", state: "DONE", sortOrder: 1 },
      { clientId: client.id, label: "First positive reply", subLabel: "Day 23", state: "DONE", sortOrder: 2 },
      { clientId: client.id, label: "First appointment booked", subLabel: "Day 25", state: "DONE", sortOrder: 3 },
      { clientId: client.id, label: "15 appointments booked", subLabel: "Day 38", state: "DONE", sortOrder: 4 },
      { clientId: client.id, label: "First program signed", subLabel: "Day 44", state: "DONE", sortOrder: 5 },
      {
        clientId: client.id,
        label: "25 appointments booked",
        subLabel: "21 of 25",
        state: "CURRENT",
        targetValue: 25,
        currentValue: 21,
        sortOrder: 6,
      },
      { clientId: client.id, label: "35 appointments booked", subLabel: "Next target", state: "NEXT", targetValue: 35, sortOrder: 7 },
    ],
  });

  type SeedEntry = {
    audience: typeof dealers;
    stage: "STAGE_1" | "STAGE_2" | "STAGE_3" | "STAGE_4";
    contactName: string;
    company: string;
    dealValue?: number;
    notes?: string;
    qualified?: boolean;
    disqualifiedReason?: string;
    callStatus?: "CONFIRMED" | "PENDING" | "HELD" | "NO_SHOW";
    callDate?: string;
    callType?: "DISCOVERY" | "SALES";
    nextActionStep?: string;
  };

  const entries: SeedEntry[] = [
    // STAGE_1
    { audience: dealers, stage: "STAGE_1", contactName: "Marcus Deering", company: "Route 9 Auto Sales", notes: "Qualifying" },
    { audience: bhph, stage: "STAGE_1", contactName: "Sherry Lomax", company: "Big Sky Motors", notes: "Qualifying" },
    { audience: dealers, stage: "STAGE_1", contactName: "Ivan Petrosyan", company: "Trailhead Auto Group", notes: "Qualifying" },
    { audience: bhph, stage: "STAGE_1", contactName: "Delia Marchetti", company: "Coastal Motor Credit", notes: "Qualifying" },
    { audience: dealers, stage: "STAGE_1", contactName: "Owen Kastner", company: "Kastner Import Motors", notes: "Qualifying" },

    // STAGE_2 — upcoming
    {
      audience: dealers, stage: "STAGE_2", contactName: "Renata Sikes", company: "Sikes Certified Auto",
      dealValue: 95_000, notes: "Wants to expand subprime volume", qualified: true,
      callStatus: "CONFIRMED", callDate: "2026-07-27", callType: "DISCOVERY", nextActionStep: "Send program term sheet ahead of the call",
    },
    {
      audience: bhph, stage: "STAGE_2", contactName: "Foster Danning", company: "Danning Family Motors",
      dealValue: 70_000, notes: "3-lot operator, current lender pulling back", qualified: true,
      callStatus: "CONFIRMED", callDate: "2026-07-29", callType: "DISCOVERY", nextActionStep: "Pull their portfolio snapshot before the call",
    },
    {
      audience: dealers, stage: "STAGE_2", contactName: "Gwen Alcott", company: "Alcott Motorplex",
      dealValue: 140_000, notes: "High volume, 4 locations", qualified: true,
      callStatus: "PENDING", callDate: "2026-08-03", callType: "DISCOVERY", nextActionStep: "Loop in regional underwriter",
    },

    // STAGE_3 — held (with the realistic wrinkles)
    {
      audience: dealers, stage: "STAGE_3", contactName: "Hector Villareal", company: "Villareal Auto Plaza",
      dealValue: 110_000, qualified: true, callStatus: "HELD", callDate: "2026-07-09", callType: "DISCOVERY",
      nextActionStep: "Send signed program docs",
    },
    {
      audience: bhph, stage: "STAGE_3", contactName: "Marlene Ott", company: "Ott's BHPH Superstore",
      dealValue: 85_000, qualified: true, callStatus: "HELD", callDate: "2026-07-15", callType: "SALES",
      nextActionStep: "Follow up on revised rate sheet",
    },
    {
      audience: dealers, stage: "STAGE_3", contactName: "Jasper Quill", company: "Quill Motor Credit",
      dealValue: 60_000, qualified: true, callStatus: "HELD", callDate: "2026-07-18", callType: "DISCOVERY",
      nextActionStep: "Confirm underwriting timeline with client",
    },
    {
      // realistic wrinkle — no-show
      audience: bhph, stage: "STAGE_3", contactName: "Corbin Wexley", company: "Wexley Auto Outlet",
      qualified: false, callStatus: "NO_SHOW", callDate: "2026-07-12", callType: "DISCOVERY",
      nextActionStep: "One reschedule attempt, then move on",
    },
    {
      // realistic wrinkle — disqualified
      audience: dealers, stage: "STAGE_3", contactName: "Nadia Bloom", company: "Bloom Discount Autos",
      qualified: false, disqualifiedReason: "Volume too low for a dedicated program", callStatus: "HELD", callDate: "2026-07-19", callType: "DISCOVERY",
    },

    // STAGE_4 — closed
    {
      audience: dealers, stage: "STAGE_4", contactName: "Preston VanDoren", company: "VanDoren Auto Finance",
      dealValue: 130_000, notes: "Program signed, first draw scheduled", qualified: true,
    },
    {
      audience: bhph, stage: "STAGE_4", contactName: "Colleen Ashby", company: "Ashby Motor Sales",
      dealValue: 90_000, notes: "Program signed", qualified: true,
    },
  ];

  const positiveReplyBase = new Date("2026-06-17T00:00:00.000Z").getTime();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    await prisma.pipelineEntry.create({
      data: {
        clientId: client.id,
        audienceId: e.audience.id,
        stage: e.stage,
        contactName: e.contactName,
        company: e.company,
        dealValue: e.dealValue ?? null,
        notes: e.notes ?? null,
        qualified: e.qualified ?? true,
        disqualifiedReason: e.disqualifiedReason ?? null,
        nextActionStep: e.nextActionStep ?? null,
        positiveReplyDate: new Date(positiveReplyBase + i * 30 * 3_600_000),
        callDateTime: e.callDate ? new Date(`${e.callDate}T00:00:00.000Z`) : null,
        callStatus: e.callStatus ?? null,
        calls: e.callDate
          ? { create: { type: e.callType ?? "DISCOVERY", date: new Date(`${e.callDate}T00:00:00.000Z`) } }
          : undefined,
      },
    });
  }

  const days = businessDays("2026-06-16", "2026-07-23");
  const dailyRows = days.map((date, i) => {
    const sends = Math.round(210 + i * 9);
    const totalReplies = Math.round(sends * (0.06 + Math.cos(i / 4) * 0.012));
    const positiveReplies = Math.round(totalReplies * 0.32);
    const bounces = Math.round(sends * 0.014);
    return { date, sends, totalReplies, positiveReplies, bounces };
  });
  await prisma.dailyStat.createMany({
    data: dailyRows.map((r) => ({
      clientId: client.id,
      date: new Date(`${r.date}T00:00:00.000Z`),
      sends: r.sends,
      totalReplies: r.totalReplies,
      positiveReplies: r.positiveReplies,
      bounces: r.bounces,
    })),
  });
  await prisma.audienceDailyStat.createMany({
    data: dailyRows.flatMap((r) => [
      {
        audienceId: dealers.id,
        date: new Date(`${r.date}T00:00:00.000Z`),
        sends: Math.round(r.sends * 0.55),
        totalReplies: Math.round(r.totalReplies * 0.55),
        positiveReplies: Math.round(r.positiveReplies * 0.55),
        bounces: Math.round(r.bounces * 0.55),
      },
      {
        audienceId: bhph.id,
        date: new Date(`${r.date}T00:00:00.000Z`),
        sends: r.sends - Math.round(r.sends * 0.55),
        totalReplies: r.totalReplies - Math.round(r.totalReplies * 0.55),
        positiveReplies: r.positiveReplies - Math.round(r.positiveReplies * 0.55),
        bounces: r.bounces - Math.round(r.bounces * 0.55),
      },
    ]),
  });

  await prisma.infrastructureItem.createMany({
    data: [
      { clientId: client.id, label: "Domains", quantity: 8, status: "ACTIVE", monthlyCost: 96, notes: "Sending domains for campaign", sortOrder: 1 },
      { clientId: client.id, label: "Inboxes", quantity: 24, status: "ACTIVE", monthlyCost: 288, notes: "Distributed across domains", sortOrder: 2 },
      { clientId: client.id, label: "Warmup / sending tool", quantity: 1, status: "ACTIVE", monthlyCost: 99, notes: "Smartlead + warmup", sortOrder: 3 },
      { clientId: client.id, label: "Lead data", quantity: 6000, status: "LOADED", monthlyCost: 210, notes: "Dealer & BHPH lot list, verified", sortOrder: 4 },
      { clientId: client.id, label: "Email verification", quantity: 6000, status: "COMPLETE", monthlyCost: 48, notes: "Validation completed", sortOrder: 5 },
      { clientId: client.id, label: "Tracking / routing setup", quantity: 1, status: "COMPLETE", monthlyCost: 34, notes: "Calendar and attribution setup", sortOrder: 6 },
    ],
  });

  await prisma.metricConfig.createMany({
    data: [
      { clientId: client.id, metricKey: "EMAILS_SENT", cadence: "WEEKLY", targetMin: 3000, tips: ["More inboxes", "Expand dealer list coverage"], sortOrder: 1 },
      { clientId: client.id, metricKey: "POSITIVE_REPLIES", cadence: "WEEKLY", targetMin: 22, tips: ["Sharper subject lines", "Segment BHPH vs franchise messaging"], sortOrder: 2 },
      { clientId: client.id, metricKey: "QUALIFIED_APPTS", cadence: "WEEKLY", targetMin: 5, tips: ["Faster reply follow-up", "Tighter pre-call qualification"], sortOrder: 3 },
      { clientId: client.id, metricKey: "POSITIVE_REPLY_RATE", cadence: "PERPETUAL", targetMin: 28, targetMax: 42, tips: ["Refine targeting", "Test new opener"], sortOrder: 4 },
      { clientId: client.id, metricKey: "EMAILS_PER_BOOKED", cadence: "PERPETUAL", targetMax: 500, tips: ["Improve program pitch clarity", "Better calendar conversion"], sortOrder: 5 },
      { clientId: client.id, metricKey: "EMAILS_PER_QUALIFIED", cadence: "PERPETUAL", targetMax: 700, tips: ["Better qualification criteria", "Higher show rate"], sortOrder: 6 },
    ],
  });

  await prisma.weeklyNote.create({
    data: {
      clientId: client.id,
      weekOf: new Date("2026-07-20T00:00:00.000Z"),
      headline: "BHPH segment is outperforming — leaning in.",
      body:
        "Ott's and Danning both came from the BHPH list and it's converting noticeably better than the franchise-dealer list this month. Shifting more send volume toward BHPH lots next week. VanDoren's first draw goes out this week too — good proof point to reference on upcoming calls with similar-sized operators.",
      published: true,
    },
  });

  await prisma.changelogEntry.createMany({
    data: [
      { clientId: client.id, date: new Date("2026-06-25T00:00:00.000Z"), title: "Split messaging by segment", body: "Separated franchise-dealer and BHPH sequences after early replies showed very different objections." },
      { clientId: client.id, date: new Date("2026-07-08T00:00:00.000Z"), title: "Added 2 sending domains", body: "Scaled sending volume ahead of the BHPH push without risking deliverability." },
      { clientId: client.id, date: new Date("2026-07-19T00:00:00.000Z"), title: "Tightened qualification on deal size", body: "Excluded sub-$500K annual volume lots after Bloom Discount Autos didn't meet program minimums." },
    ],
  });

  await prisma.internalNote.createMany({
    data: [
      { clientId: client.id, date: new Date("2026-07-10T00:00:00.000Z"), title: "Check-in call", body: "Client wants weekly instead of biweekly reporting — switching cadence starting next week." },
      { clientId: client.id, date: new Date("2026-07-19T00:00:00.000Z"), title: "Bloom disqualification", body: "Confirmed with client's underwriting lead — volume too low, fine to release from pipeline." },
    ],
  });

  await prisma.domain.createMany({
    data: [
      { domain: "autofundingoutreach.com", clientId: client.id, coldStartDate: new Date("2026-05-26T00:00:00.000Z"), note: "Primary sending domain" },
      { domain: "autofunding-mail.com", clientId: client.id, coldStartDate: new Date("2026-05-26T00:00:00.000Z"), note: "Secondary sending domain" },
      { domain: "autofunding-connect.com", clientId: client.id, coldStartDate: new Date("2026-07-01T00:00:00.000Z"), note: "Added for BHPH push" },
      { domain: "autofunding-partners.com", clientId: client.id, coldStartDate: new Date("2026-05-26T00:00:00.000Z"), burnedAt: new Date("2026-07-05T00:00:00.000Z"), note: "Retired after reply-rate drop, replaced by autofunding-connect.com" },
    ],
  });

  return client;
}

async function main() {
  const zoom = await seedZoom();
  const meridian = await seedMeridian();
  const legacyGate = await seedLegacyGateAdvisors();
  const autoFunding = await seedAutoFundingCorp();
  console.log("Seeded clients:", zoom.slug, meridian.slug, legacyGate.slug, autoFunding.slug);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
