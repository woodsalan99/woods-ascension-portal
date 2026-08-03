import "dotenv/config";
import { classifySpam } from "@/lib/spam-classify";

// Real-shaped cases: two genuine Oahu homeowners, three kinds of junk.
const CASES = [
  { label: "REAL — ceiling estimate", expect: true, data: {
    name: "Michael Agee", phone: "859-749-8802", email: "magee@gmail.com", city: "Ewa Beach",
    message: "Good morning! I would like to get an estimate to have my ceilings painted. When are you available to come out to look?" } },
  { label: "REAL — terse, no punctuation", expect: true, data: {
    name: "Kanani", phone: "808-555-2211", email: null, city: "Kailua",
    message: "need exterior painted 2 story house how much" } },
  { label: "JUNK — SEO pitch", expect: false, data: {
    name: "Digital Growth Team", phone: "+1-800-555-0100", email: "seo@rankfast.biz", city: null,
    message: "Hi, I noticed your website isn't ranking on page 1. We can get you to the top of Google for a low monthly fee. Reply for a free audit." } },
  { label: "JUNK — crypto spam", expect: false, data: {
    name: "Investment Advisor", phone: null, email: "x@bitprofits.net", city: null,
    message: "Congratulations! You qualify for a guaranteed 300% return. Click here to claim your bonus now!!!" } },
  { label: "JUNK — web design outreach", expect: false, data: {
    name: "Sarah from WebWorks", phone: "212-555-0180", email: "sarah@webworksagency.co", city: null,
    message: "We build websites for painting contractors. Can I send over a proposal? Happy to jump on a quick call this week." } },
];

async function main() {
  let pass = 0;
  for (const c of CASES) {
    const v = await classifySpam(c.data as never);
    const ok = v.qualified === c.expect;
    if (ok) pass++;
    console.log(`${ok ? "✓" : "✗ WRONG"}  ${c.label.padEnd(34)} qualified=${String(v.qualified).padEnd(5)} confidence=${v.confidence}  ${v.reason.slice(0, 70)}`);
  }
  console.log(`\n${pass}/${CASES.length} correct`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
