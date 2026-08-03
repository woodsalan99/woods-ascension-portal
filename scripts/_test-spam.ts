import "dotenv/config";
import { classifySpam } from "@/lib/spam-classify";

type Case = { label: string; expect: boolean | "either"; data: Record<string, string | null> };

const CASES: Case[] = [
  // --- real homeowners, easy ---
  { label: "ceiling estimate, full details", expect: true, data: { name: "Michael Agee", phone: "859-749-8802", email: "magee@gmail.com", location: "Ewa Beach", message: "Good morning! I would like to get an estimate to have my ceilings painted. When are you available to come out to look?" } },
  { label: "cabinets, polite", expect: true, data: { name: "Denise Tanaka", phone: "808-555-0143", email: "dt@hawaii.rr.com", location: "Kapolei", message: "Aloha, looking for a quote on painting our kitchen cabinets. White shaker style. Thank you!" } },
  // --- real, but awkward: the ones a naive filter kills ---
  { label: "terse, no punctuation", expect: true, data: { name: "Kanani", phone: "808-555-2211", email: null, location: "Kailua", message: "need exterior painted 2 story house how much" } },
  { label: "one word + phone only", expect: true, data: { name: "Rey", phone: "808-555-9080", email: null, location: null, message: "painting" } },
  { label: "no message at all", expect: "either", data: { name: "Lisa Char", phone: "808-555-4412", email: "lisac@gmail.com", location: "Mililani", message: null } },
  { label: "ALL CAPS, urgent", expect: true, data: { name: "BRAD", phone: "808-555-7788", email: null, location: "Waipahu", message: "NEED MY HOUSE PAINTED ASAP BEFORE I SELL IT. CALL ME TODAY" } },
  { label: "typos + broken english", expect: true, data: { name: "Nguyen", phone: "808-555-3390", email: null, location: "Aiea", message: "hi i want paint my hause outside and insde how mush cost you come look?" } },
  { label: "commercial, big job", expect: true, data: { name: "Property Manager - Kai Towers", phone: "808-555-1200", email: "pm@kaitowers.com", location: "Honolulu", message: "We manage a 40-unit condo and need the stairwells and common areas repainted. Can you bid?" } },
  { label: "adjacent service, still real", expect: true, data: { name: "Tom", phone: "808-555-6631", email: null, location: "Ewa Beach", message: "Do you do wallpaper removal before painting? Whole living room." } },
  // --- junk ---
  { label: "SEO pitch", expect: false, data: { name: "Digital Growth Team", phone: "+1-800-555-0100", email: "seo@rankfast.biz", location: null, message: "Hi, I noticed your website isn't ranking on page 1. We can get you to the top of Google for a low monthly fee. Reply for a free audit." } },
  { label: "crypto scam", expect: false, data: { name: "Investment Advisor", phone: null, email: "x@bitprofits.net", location: null, message: "Congratulations! You qualify for a guaranteed 300% return. Click here to claim your bonus now!!!" } },
  { label: "web design outreach", expect: false, data: { name: "Sarah from WebWorks", phone: "212-555-0180", email: "sarah@webworksagency.co", location: null, message: "We build websites for painting contractors. Can I send over a proposal? Happy to jump on a quick call this week." } },
  { label: "lead-gen reseller", expect: false, data: { name: "Marcus", phone: "702-555-0199", email: "marcus@contractorleadspro.com", location: null, message: "We have exclusive painting leads in your area, $40 each, no contract. Interested?" } },
  { label: "hiring / job seeker", expect: false, data: { name: "Jose Ramirez", phone: "808-555-2244", email: "jose.r@gmail.com", location: "Waianae", message: "Hi, I have 6 years painting experience and I'm looking for work. Are you hiring right now?" } },
  { label: "supplier pitch", expect: false, data: { name: "Coastal Coatings Supply", phone: "800-555-0177", email: "sales@coastalcoatings.com", location: null, message: "Wholesale paint pricing for contractors. 30% off your first order. Reply for our catalog." } },
  { label: "empty gibberish", expect: false, data: { name: "asdf", phone: null, email: "asdf@asdf.com", location: null, message: "asdfasdf test test" } },
  { label: "phishing", expect: false, data: { name: "Google Business", phone: null, email: "verify@g00gle-business.net", location: null, message: "Your Google Business listing will be suspended in 24 hours. Verify immediately at this link." } },
  { label: "Alan's own test submission", expect: "either", data: { name: "Alan", phone: "808-555-0123", email: "woodsalan99@gmail.com", location: null, message: "testing the form" } },
];

async function main() {
  let pass = 0, checked = 0;
  const wrong: string[] = [];
  for (const c of CASES) {
    const v = await classifySpam(c.data as never);
    const conf = Math.round(v.confidence * 100);
    if (c.expect === "either") {
      console.log(`  ~  ${c.label.padEnd(30)} qualified=${String(v.qualified).padEnd(5)} ${String(conf).padStart(3)}%  ${v.reason.slice(0, 62)}`);
      continue;
    }
    checked++;
    const ok = v.qualified === c.expect;
    if (ok) pass++; else wrong.push(c.label);
    console.log(`  ${ok ? "✓" : "✗"}  ${c.label.padEnd(30)} qualified=${String(v.qualified).padEnd(5)} ${String(conf).padStart(3)}%  ${v.reason.slice(0, 62)}`);
  }
  console.log(`\n  ${pass}/${checked} decisive cases correct${wrong.length ? ` — WRONG: ${wrong.join(", ")}` : ""}`);
  console.log("  (~ = deliberately ambiguous; either answer is defensible)");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
