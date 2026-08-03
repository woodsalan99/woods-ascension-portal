// Backfills Canencia's April–August lead history from Alan's export.
//
// TIMEZONE: Alan's source timestamps are Tallinn local (his mail client).
// April–August 2026 is EEST = UTC+3, and Hawaii is HST = UTC-10 with no
// DST, so Hawaii = Tallinn − 13h. Every datetime below is already
// converted and expressed as HST, written here as the equivalent UTC
// instant so there's no ambiguity at read time.
//
// DEDUPE: runs through recordContact(), so repeat contacts from the same
// person collapse onto one card — Kaysee O'Coyne (two enquiries) and
// Darnell Tusi (two voicemails) each become a single lead with a full
// timeline, and Michael Agee merges onto the card the live sync already
// created rather than duplicating it.
//
// STAGE: every one of these was passed to Bryan and Desiree at the time —
// that's documented. What happened next mostly isn't, so they all land in
// CONTACTED rather than inventing outcomes. Alan can drag the ones that
// became jobs or went cold.
import "dotenv/config";
import { PrismaClient, type LeadSource } from "@prisma/client";
import { recordContact } from "../src/lib/lead-identity";

const prisma = new PrismaClient();
const CLIENT_ID = "cmsbhlur60000ibgy4084d8fk";

/** A Hawaii wall-clock time expressed as the matching UTC instant (HST = UTC-10). */
const hst = (iso: string) => new Date(`${iso}-10:00`);

type Contact = { key: string; at: Date; type: string; summary: string };
type Backfill = {
  ref: string;
  name: string | null;
  phone: string | null;
  email?: string | null;
  location?: string | null;
  serviceType?: string | null;
  address?: string | null;
  message: string;
  source: LeadSource;
  contacts: Contact[];
  note?: string;
};

const LEADS: Backfill[] = [
  {
    ref: "kaysee",
    name: "Kaysee O'Coyne",
    phone: "808-389-0147",
    email: "kkocoyne@gmail.com",
    serviceType: "Interior — full home, walls only",
    message:
      "Wants a quote for a full home, interior walls only, on a 1,751 sq ft house. Sent a floor plan. Bryan replied asking about doors and trim, whether the walls are textured or smooth, wall height, and how many colours — and said he'd want to see it in person for a precise quote.",
    source: "WEBSITE_FORM",
    contacts: [
      {
        key: "kaysee:email",
        at: hst("2026-07-08T20:27:00"),
        type: "FORM",
        summary: "Emailed asking for a quote — full home, walls only, 1,751 sq ft",
      },
      {
        key: "kaysee:phone",
        at: hst("2026-07-08T20:30:00"),
        type: "NOTE",
        summary: "Followed up with his number: 808-389-0147",
      },
      {
        key: "kaysee:site",
        at: hst("2026-07-16T12:00:00"),
        type: "FORM",
        summary: "Same enquiry came through the website form as well",
      },
      {
        key: "kaysee:bryan",
        at: hst("2026-07-16T12:30:00"),
        type: "NOTE",
        summary:
          "Bryan replied: asked about doors/trim, textured vs smooth, wall height and number of colours; wants to see it in person before quoting",
      },
    ],
    note: "Alan's export dates the email July 9 and the website form July 16 — recorded as given.",
  },
  {
    ref: "lsa-kailua",
    name: null,
    phone: "727-465-6542",
    location: "Kailua",
    serviceType: "Interior painting",
    message:
      "Looking for quotes on painting a few rooms — 3 small bedrooms and 1 medium sized room. Came through Google Local Services Ads; Google initially hid the number (405-331-1785 ext. 50432), then they messaged their real mobile.",
    source: "LSA",
    contacts: [
      {
        key: "lsa-kailua:request",
        at: hst("2026-07-30T21:00:00"),
        type: "LSA_REQUEST",
        summary: "Google Ads request — Interior painting · Kailua, 3 small bedrooms and 1 medium room",
      },
      {
        key: "lsa-kailua:message",
        at: hst("2026-07-31T09:00:00"),
        type: "LSA_REQUEST",
        summary: "Replied through Google with their mobile number: 727-465-6542",
      },
    ],
  },
  {
    ref: "missed-3929242",
    name: null,
    phone: "808-392-9242",
    message: "Missed call. Desiree asked for the number so she could ring back.",
    source: "GBP_CALL",
    contacts: [
      {
        key: "missed-3929242:call",
        at: hst("2026-07-31T12:00:00"),
        type: "MISSED_CALL",
        summary: "Missed call — number passed to Desiree to ring back",
      },
    ],
  },
  {
    ref: "neil",
    name: "Neil",
    phone: "808-753-5004",
    location: "Manoa",
    serviceType: "Interior painting",
    message: "Voicemail: looking to get painting done at his studio in Manoa — all interior.",
    source: "GBP_CALL",
    contacts: [
      {
        key: "neil:vm",
        at: hst("2026-07-29T12:00:00"),
        type: "CALL",
        summary: "Voicemail: interior painting for a studio in Manoa",
      },
    ],
  },
  {
    ref: "lsa-kapolei-cabinets",
    name: null,
    phone: "360-712-0226",
    location: "Kapolei",
    serviceType: "Kitchen cabinet painting",
    message:
      "Google Local Services Ads lead in Kapolei looking for kitchen cabinet painting. Extension 06124 if asked. Alan flagged it as not a perfect fit but worth a quick call.",
    source: "LSA",
    contacts: [
      {
        key: "lsa-kapolei:request",
        at: hst("2026-07-20T12:00:00"),
        type: "LSA_REQUEST",
        summary: "Google Ads request — kitchen cabinet painting · Kapolei",
      },
    ],
  },
  {
    ref: "paul-nishizaki",
    name: "Paul Nishizaki",
    phone: "808-554-3796",
    location: "Wahiawa",
    serviceType: "Interior painting",
    message: "Voicemail: wants an estimate for interior painting of a house in Wahiawa.",
    source: "GBP_CALL",
    contacts: [
      {
        key: "paul:vm",
        at: hst("2026-07-03T12:00:00"),
        type: "CALL",
        summary: "Voicemail: estimate for interior painting, Wahiawa",
      },
    ],
  },
  {
    ref: "ads-3059787992",
    name: null,
    phone: "305-978-7992",
    serviceType: "Interior painting",
    message: "Called through the Google ads late in the evening looking for indoor painting.",
    source: "LSA",
    contacts: [
      {
        key: "ads-305:call",
        at: hst("2026-06-23T20:40:00"),
        type: "CALL",
        summary: "Called through Google Ads at 8:40pm — indoor painting",
      },
    ],
  },
  {
    ref: "chris-woodman",
    name: "Chris Woodman",
    phone: "808-348-8454",
    serviceType: "Exterior, possibly interior too",
    message:
      "Voicemail: wants the exterior of his house repainted, and potentially the interior as well. Asked for a callback to arrange a time to look.",
    source: "GBP_CALL",
    contacts: [
      {
        key: "chris:vm",
        at: hst("2026-06-10T12:00:00"),
        type: "CALL",
        summary: "Voicemail: exterior repaint, possibly interior too",
      },
    ],
  },
  {
    ref: "lsa-cabinets-3978262",
    name: null,
    phone: "808-397-8262",
    serviceType: "Cabinet painting",
    message:
      "Cabinets — kitchen, entry cube and two bathroom cabinets, currently red/brown, wants them painted a light oak. Came through Google Local Services Ads without a name. This was the first lead the ads produced.",
    source: "LSA",
    contacts: [
      {
        key: "lsa-cabinets:request",
        at: hst("2026-06-08T12:00:00"),
        type: "LSA_REQUEST",
        summary: "Google Ads request — cabinets, red/brown to light oak (first ever ads lead)",
      },
    ],
  },
  {
    ref: "kathy-realtor",
    name: "Kathy",
    phone: "808-728-5696",
    location: "Mililani",
    serviceType: "Interior painting",
    message:
      "Realtor. Voicemail: needs an interior paint job for a townhome in Mililani, hoping to start the following week.",
    source: "GBP_CALL",
    contacts: [
      {
        key: "kathy:vm",
        at: hst("2026-06-05T12:00:00"),
        type: "CALL",
        summary: "Voicemail: realtor, interior for a Mililani townhome, wants to start next week",
      },
    ],
  },
  {
    ref: "darnell-tusi",
    name: "Darnell Tusi",
    phone: "808-348-9501",
    location: "Nanakuli",
    serviceType: "Exterior — porch and ramp",
    message:
      "Two voicemails. First about a porch with a ramp in Nanakuli — he already has the primer and paint, just needs someone to do it. Then again about the paint project in Nanakuli, having emailed pictures over, asking for a quote.",
    source: "GBP_CALL",
    contacts: [
      {
        key: "darnell:vm1",
        at: hst("2026-05-19T12:00:00"),
        type: "CALL",
        summary: "Voicemail: porch with a ramp in Nanakuli, has his own primer and paint",
      },
      {
        key: "darnell:vm2",
        at: hst("2026-05-22T12:00:00"),
        type: "CALL",
        summary: "Voicemail again: sent pictures by email, wants a quote for the Nanakuli project",
      },
    ],
  },
  {
    ref: "honolulu-lowvoc",
    name: null,
    phone: "808-555-0199",
    location: "Honolulu",
    serviceType: "Interior painting",
    message: "Website form: quote for interior painting of 2 rooms with 10ft ceilings, low-VOC paint.",
    source: "WEBSITE_FORM",
    contacts: [
      {
        key: "honolulu-lowvoc:form",
        at: hst("2026-05-02T12:00:00"),
        type: "FORM",
        summary: "Website form: 2 rooms, 10ft ceilings, low-VOC paint",
      },
    ],
    note: "Phone number follows the 555-01xx fictional pattern — may have been a test submission rather than a real enquiry.",
  },
  {
    ref: "sarah-cabinets",
    name: "Sarah",
    phone: "808-979-1098",
    serviceType: "Kitchen cabinet painting",
    message: "Voicemail: asking about getting kitchen cabinets painted.",
    source: "GBP_CALL",
    contacts: [
      {
        key: "sarah:vm",
        at: hst("2026-04-30T12:00:00"),
        type: "CALL",
        summary: "Voicemail: kitchen cabinets (exact date wasn't recorded — placed late April)",
      },
    ],
    note: "No date was given in the export; positioned between the Apr 29 and May 2 entries.",
  },
  {
    ref: "victoria",
    name: "Victoria",
    phone: "845-662-9443",
    email: "vmb215@gmail.com",
    location: "Kapolei",
    serviceType: "Interior — kitchen and living room",
    message: "Website form: free quote on painting the downstairs kitchen and living room interior.",
    source: "WEBSITE_FORM",
    contacts: [
      {
        key: "victoria:form",
        at: hst("2026-04-29T12:00:00"),
        type: "FORM",
        summary: "Website form: downstairs kitchen and living room, Kapolei",
      },
    ],
  },
  {
    ref: "ewa-1300sqft",
    name: null,
    phone: "907-231-9177",
    location: "Ewa Beach",
    serviceType: "Interior painting",
    message: "Voicemail: wants an estimate on repainting the interior of a 1,300 sq ft home in Ewa Beach.",
    source: "GBP_CALL",
    contacts: [
      {
        key: "ewa-1300:vm",
        at: hst("2026-04-26T12:47:00"),
        type: "CALL",
        summary: "Voicemail: interior repaint, 1,300 sq ft home in Ewa Beach",
      },
    ],
  },
  {
    ref: "casey-schmucker",
    name: "Casey Schmucker",
    phone: "808-635-4869",
    email: "mordencasey@gmail.com",
    location: "Ewa Beach",
    serviceType: "Accent wall",
    message: "Website form: needs a quote for an accent wall.",
    source: "WEBSITE_FORM",
    contacts: [
      {
        key: "casey:form",
        at: hst("2026-04-24T12:00:00"),
        type: "FORM",
        summary: "Website form: quote for an accent wall",
      },
    ],
  },
  {
    ref: "midori",
    name: "Midori",
    phone: "808-258-4443",
    location: "Ewa Beach",
    address: "91-1170 Olowa St, Ewa Beach, HI",
    serviceType: "Exterior painting",
    message: "Website form: wants the exterior of the home painted. Alan texted to say Bryan would be in touch.",
    source: "WEBSITE_FORM",
    contacts: [
      {
        key: "midori:form",
        at: hst("2026-04-20T12:00:00"),
        type: "FORM",
        summary: "Website form: exterior of the home, 91-1170 Olowa St",
      },
    ],
  },
];

// Milestones from Alan's notes — these belong in the monthly recap, not
// the lead board.
const WORK_LOG = [
  {
    at: hst("2026-05-04T12:00:00"),
    body: "Set up instant phone notifications for Bryan and Desiree — every new call (with voicemail transcript) and every website contact form now alerts them straight away. Added a shared tracking sheet, and set up text-message forwarding from the Google Maps number.",
  },
  {
    at: hst("2026-05-20T12:00:00"),
    body: "Google Local Services Ads finally went live. The dashboard had been showing them as running since the start of May, but nothing was coming through — after several calls Google confirmed the ads had never actually activated, and it took until this week to get it fixed.",
  },
];

async function main() {
  console.log("=== Backfilling leads ===");
  let created = 0;
  let merged = 0;

  // Oldest first, so each lead's receivedAt reflects its true first contact.
  const ordered = [...LEADS].sort((a, b) => a.contacts[0].at.getTime() - b.contacts[0].at.getTime());

  for (const lead of ordered) {
    const first = lead.contacts[0];
    let isNew = false;

    for (const [i, contact] of lead.contacts.entries()) {
      const result = await recordContact({
        clientId: CLIENT_ID,
        identity: { phone: lead.phone, name: lead.name },
        event: {
          type: contact.type,
          dedupeKey: `backfill:${contact.key}`,
          occurredAt: contact.at,
          summary: contact.summary,
          meta: { backfill: true },
        },
        create: {
          source: lead.source,
          // Documented fact: all of these were passed to Bryan/Desiree.
          stage: "CONTACTED",
          name: lead.name,
          phone: lead.phone,
          email: lead.email ?? null,
          location: lead.location ?? null,
          serviceType: lead.serviceType ?? null,
          address: lead.address ?? null,
          message: lead.message,
          receivedAt: first.at,
        },
        enrich: {
          name: lead.name,
          phone: lead.phone,
          email: lead.email ?? null,
          location: lead.location ?? null,
          serviceType: lead.serviceType ?? null,
        },
      });
      if (i === 0) isNew = result.isNewLead;
    }

    if (isNew) created++;
    else merged++;
    const label = lead.name ?? lead.phone ?? lead.ref;
    console.log(`  ${isNew ? "created" : "merged "}  ${label.padEnd(24)} ${lead.contacts.length} contact(s)`);
    if (lead.note) console.log(`            note: ${lead.note}`);
  }

  console.log("\n=== Work log (for the monthly recaps) ===");
  for (const w of WORK_LOG) {
    const existing = await prisma.workLog.findFirst({ where: { clientId: CLIENT_ID, body: w.body } });
    if (existing) {
      console.log("  already present:", w.body.slice(0, 60) + "…");
      continue;
    }
    await prisma.workLog.create({ data: { clientId: CLIENT_ID, body: w.body, createdAt: w.at, source: "ADMIN_NOTE" } });
    console.log("  added:", w.body.slice(0, 60) + "…");
  }

  const total = await prisma.serviceLead.count({ where: { clientId: CLIENT_ID } });
  console.log(`\n  ${created} new lead card(s), ${merged} merged onto existing. ${total} leads on the board.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
