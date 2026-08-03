// Registry of every client-facing string on LOCAL_SERVICES pages —
// stable namespaced key -> default copy. See IMPLEMENTATION_STATE.md §3a.
//
// HARD RULE: no hardcoded client-facing strings on local-services pages.
// If a string renders on a local-services page, it must have a key here
// and render through <E>/<EList> (src/components/ls/Editable.tsx).
//
// Multi-paragraph blocks get one key per paragraph/list item. Lists whose
// LENGTH Alan may change (thesis bullets, weekly habits) store an ordered
// JSON array under one key (kind: "list").
//
// Bold spans in defaults use **this** markdown-style marker — <E> renders
// it as <b>; an edited value is always plain text and loses the emphasis
// (accepted — see IMPLEMENTATION_STATE.md §3a "Hardest lines, settled").

export type ContentEntry = { def: string; max?: number } | { kind: "list"; def: string[]; maxItem?: number };

export const LS_CONTENT = {
  // ---- Overview / 30-second thesis ----
  "overview.thesis.summaryLabel": { def: "30-second summary of our campaign plan", max: 120 },
  "overview.thesis.intro": {
    def: "Our plan is simple. We bring in more leads through three things: **your website**, **Google Local Service Ads**, and **Google Maps**.",
    max: 400,
  },
  "overview.thesis.items": {
    kind: "list",
    maxItem: 300,
    def: [
      "**The website** — we add more town pages every month, and build links to them.",
      "**Local Service Ads** — more reviews is what lifts you here.",
      "**Google Maps** — more reviews, and more photos from your jobs.",
    ],
  },
  "overview.thesis.needs": {
    def: "The core things I need from you: **respond to leads quickly**, **follow up with them**, **send me names for reviews**, and **share photos from your projects**. I'll handle everything else.",
    max: 500,
  },
  "overview.thesis.expand": {
    def: "With that foundation in place, we'll keep seeing progress — and once it's working, we can expand into other things like Facebook ads.",
    max: 400,
  },

  // ---- Overview / hero (shown until a MonthlyWork row exists for the current month) ----
  "overview.hero.titleDefault": { def: "Welcome to your growth portal.", max: 150 },
  "overview.hero.subDefault": {
    def: "This is where you'll see your leads, your rankings, and everything we're building for you — updated as it happens.",
    max: 400,
  },

  // ---- Overview / work block ----
  "overview.work.label": { def: "Work completed this month", max: 80 },
  "overview.work.title": { def: "What we built for you this month", max: 120 },
  "overview.work.sub": {
    def: "Some of this shows up in the numbers right away. Most of it takes a few months to pay off — but it's all getting done.",
    max: 300,
  },
  "overview.work.empty": { def: "Nothing logged yet this month — check back soon.", max: 200 },

  // ---- Overview / KPI card labels ----
  // The v8 mock rendered this as "Real customers who reached out / Leads" —
  // that slash was two candidate labels, not copy. Picked the plain one.
  "overview.kpi.leads.label": { def: "Real customers who reached out", max: 100 },
  "overview.kpi.cpl.label": { def: "Cost per lead from Google Local Service Ads", max: 100 },
  "overview.kpi.pages.label": { def: "Pages showing on Google", max: 100 },
  "overview.kpi.reviews.label": { def: "Your Google reviews", max: 100 },

  // ---- Overview / needs-you queue ----
  "overview.needsYou.title": { def: "Needs you", max: 60 },
  "overview.needsYou.sub": { def: "Leads waiting on a next step", max: 100 },
  "overview.needsYou.empty": { def: "Nothing needs your attention right now.", max: 200 },

  // ---- The Numbers ----
  "numbers.eyebrow": { def: "The numbers", max: 60 },
  "numbers.title": { def: "The numbers", max: 60 },
  "numbers.sub": {
    def: "Everything worth watching, in two groups. The \"healthy\" note under each one is what's realistic for a painter on Oahu — not a national average from a much bigger city.",
    max: 400,
  },
  "numbers.ads.title": { def: "Your Google ads", max: 60 },
  "numbers.ads.sub": { def: "The paid listings at the very top of Google", max: 120 },
  "numbers.customers.title": { def: "Your customers & reputation", max: 80 },
  "numbers.customers.sub": { def: "What's actually coming in", max: 120 },

  "numbers.adLeads.label": { def: "Leads from Google Ads", max: 80 },
  "numbers.adLeads.plain": { def: "People who called or messaged you straight from the paid listing at the top of Google.", max: 300 },
  "numbers.adLeads.healthy": { def: "1–4 a month is what this market gives. There simply aren't many painting searches on Oahu each month.", max: 300 },
  "numbers.adLeads.improve": { def: "Keep you first in line for every search there is|Dispute junk leads so you're not charged for them", max: 400 },

  "numbers.cpl.label": { def: "What each ad lead cost", max: 80 },
  "numbers.cpl.plain": { def: "Google only charges when a real person contacts you — never for being seen. This is ad cost only, separate from our monthly fee.", max: 300 },
  "numbers.cpl.healthy": { def: "$20–50 is healthy for painting. The national average is about $53, so you're paying well under half.", max: 300 },
  "numbers.cpl.improve": { def: "Dispute junk leads so Google refunds them|Keep the settings tight to the work you actually want", max: 400 },

  "numbers.impressions.label": { def: "Times your ad was seen", max: 80 },
  "numbers.impressions.plain": { def: "How many people on Oahu searched for a painter and saw your listing.", max: 300 },
  "numbers.impressions.healthy": { def: "200–400 a month is simply how many people search here. It's a small island — this isn't a number we can push much higher.", max: 300 },
  "numbers.impressions.improve": { def: "Keep every painting service switched on|Cover the whole island, available 24/7", max: 400 },

  "numbers.topRate.label": { def: "How often you're shown first", max: 80 },
  "numbers.topRate.plain": { def: "When your ad shows up, this is how often you're the very first painter on the page — above every competitor.", max: 300 },
  "numbers.topRate.healthy": { def: "Anything above 85% is strong. There is no higher spot to win.", max: 300 },
  "numbers.topRate.improve": { def: "Answer or return every lead quickly|Keep new reviews coming in steadily", max: 400 },

  "numbers.spend.label": { def: "Ad money spent", max: 80 },
  "numbers.spend.plain": { def: "What you actually paid Google this month. You only pay when someone contacts you.", max: 300 },
  "numbers.spend.healthy": { def: "Money has never been what's holding this back — there simply aren't many searches to pay for. That's exactly why the website work matters.", max: 400 },
  "numbers.spend.improve": { def: "Keep the unused budget rather than spending it for the sake of it|Look at other channels once the website work has matured", max: 400 },

  "numbers.leads.label": { def: "Real customers who reached out", max: 80 },
  "numbers.leads.plain": { def: "Actual homeowners wanting a quote for a job.", max: 300 },
  "numbers.leads.healthy": { def: "4–10 a month is realistic today. This should climb as the town pages get onto Google.", max: 300 },
  "numbers.leads.improve": { def: "Reach people outside Ewa Beach|Text back automatically on missed calls", max: 400 },

  "numbers.organic.label": { def: "Free (organic) leads", max: 80 },
  "numbers.organic.plain": { def: "People who found you without you paying anything. These cost nothing per lead.", max: 300 },
  "numbers.organic.healthy": { def: "This is the number the town pages are built to grow.", max: 300 },
  "numbers.organic.improve": { def: "More pages, more reviews, more photos|Climb the map ranking across the island", max: 400 },

  "numbers.jobs.label": { def: "Jobs won", max: 60 },
  "numbers.jobs.plain": { def: "Leads that turned into real paid jobs this month.", max: 300 },
  "numbers.jobs.healthy": { def: "Roughly 1 in 3 quotes turning into a job is healthy for painting.", max: 300 },
  "numbers.jobs.improve": { def: "Make sure every quote gets a follow-up|Get to new leads faster than competitors", max: 400 },

  "numbers.reviews.label": { def: "Your Google reviews", max: 80 },
  "numbers.reviews.plain": { def: "When someone's comparing three painters, review count is usually what decides it.", max: 300 },
  "numbers.reviews.healthy": { def: "2–4 new reviews a month is healthy. This is the single biggest thing holding your map ranking back.", max: 300 },
  "numbers.reviews.improve": { def: "Ask every finished customer|One polite reminder if they don't reply", max: 400 },

  "numbers.chart.label": { def: "Since we started", max: 60 },
  "numbers.chart.title": { def: "Ad views and real customers, month by month", max: 120 },
  "numbers.chart.note": {
    def: "The grey bars are how many people saw your ad. They stay fairly flat, which tells us the size of the search market on Oahu — that ceiling is why the website work matters.",
    max: 400,
  },

  // ---- What I Need From You ----
  "ask.eyebrow": { def: "Your side of it", max: 60 },
  "ask.title": { def: "What I need from you", max: 80 },
  "ask.sub": {
    def: "Everything I need on your end, in one place — so you never have to dig through texts or emails to find it.",
    max: 300,
  },
  "ask.now.title": { def: "Right now", max: 60 },
  "ask.now.sub": {
    def: "Specific things that will move the campaign forward. Tick them off, or type and upload straight into the boxes.",
    max: 300,
  },
  "ask.habits.label": { def: "Every week", max: 60 },
  "ask.habits.title": { def: "The things that move the needle", max: 100 },
  "ask.habits.sub": { def: "None of these take long. All of them compound.", max: 200 },
  "ask.habits.items": {
    kind: "list",
    maxItem: 500,
    def: [
      "📞|Pick up, or call back fast|Most homeowners call three painters and go with whoever answers first. If you can't pick up, they get an automatic text — but a real callback within the hour is what wins the job.|Google also watches how fast you respond, and ranks you higher for it.",
      "↩️|Chase every quote you send|A quote with no follow-up is a coin flip. One call a few days later is usually what turns it into a job.|This is the cheapest work you'll ever do — the lead is already paid for.",
      "↔️|Move leads across as things change|When you send a quote, book a job, or lose one — move the card on the Leads page. Takes two seconds.|It's the only way we can see which of your listings actually brings in paying work.",
      "⭐|Send me names for reviews|Any happy customer, any time. Use the box below, or just text me. I handle the asking and the follow-up.|Reviews are the number one thing deciding your Google Maps position.",
      "📸|Take photos at every job|Before, during, after. Phone photos are perfectly fine. Send them whenever — no need to organise them.|Photos are the second biggest ranking factor, and Google favours profiles with fresh ones going up regularly.",
    ],
  },
  "ask.reviews.label": { def: "Reviews", max: 60 },
  "ask.reviews.title": { def: "Add customers you'd like us to ask", max: 100 },
  "ask.reviews.sub": {
    def: "Drop a name in whenever you finish a job. We send the request and the follow-up — you don't do anything else.",
    max: 300,
  },
  "ask.reviews.empty": { def: "Nobody in the queue right now.", max: 150 },

  // ---- Where You Rank ----
  "rank.eyebrow": { def: "Google Maps", max: 60 },
  "rank.title": { def: "Where you rank", max: 80 },
  "rank.sub": {
    def: "Every month we check what position you come up in when someone searches from different spots around the island. Here's what we found.",
    max: 300,
  },
  "rank.howToRead.title": { def: "How to read the map below.", max: 100 },
  "rank.howToRead.body": {
    def: "Think of the grid as Oahu. Each circle is a spot where someone might be standing when they pull out their phone and search. The number inside is where you came up in the list of painters — so **1 means you were the very first painter shown** to someone standing there. Green is good.",
    max: 600,
  },
  "rank.whyVaries.title": { def: "Why the numbers are different in each spot.", max: 100 },
  "rank.whyVaries.body": {
    def: "You don't have one single position on Google. Where you show up changes depending on where the customer is searching from and how far that is from your business — someone in Ewa Beach sees a completely different list than someone in Kailua. That's why we check the whole island instead of just one place.",
    max: 600,
  },
  "rank.monthStrip.label": { def: "Your average position, month by month", max: 100 },
  "rank.monthStrip.title": { def: "Are we improving?", max: 80 },
  "rank.monthStrip.sub": {
    def: "This is your average across every spot on the map and every search term we check. Lower is better.",
    max: 300,
  },
  "rank.monthStrip.footnote": {
    def: "The goal is to get that average under 5, which is roughly when you start appearing in the small map box at the top of Google without anyone having to scroll.",
    max: 400,
  },
  "rank.factors.label": { def: "What actually moves these numbers", max: 100 },
  "rank.factors.title": { def: "The things that decide your position", max: 120 },
  "rank.factors.sub": {
    def: "Google weighs a handful of things when it decides which painter to show first. Two of them are almost entirely in your hands.",
    max: 300,
  },
  "rank.factors.reviews.tag": { def: "Biggest lever · yours", max: 40 },
  "rank.factors.reviews.title": { def: "Reviews", max: 40 },
  "rank.factors.reviews.body": {
    def: "How many you have, how good they are, and how recently they came in. A steady trickle beats a big burst — Google wants to see new ones arriving month after month.",
    max: 400,
  },
  "rank.factors.photos.tag": { def: "Biggest lever · yours", max: 40 },
  "rank.factors.photos.title": { def: "Photos", max: 40 },
  "rank.factors.photos.body": {
    def: "Google favours profiles with real, recent job photos going up regularly. Before-and-afters do particularly well, and customers scroll them before they call.",
    max: 400,
  },
  "rank.factors.photos.you": {
    def: "Send a few from every job — phone photos are completely fine.",
    max: 300,
  },
  "rank.factors.distance.tag": { def: "Partly ours", max: 40 },
  "rank.factors.distance.title": { def: "Distance from the customer", max: 60 },
  "rank.factors.distance.body": {
    def: "The single biggest factor, and the one nobody controls. Being based in Ewa Beach means you'll always rank stronger nearby and weaker on the windward side.",
    max: 400,
  },
  "rank.factors.distance.you": {
    def: "This is why the town pages matter — they're how we tell Google you genuinely work across the whole island.",
    max: 300,
  },
  "rank.factors.website.tag": { def: "Ours", max: 40 },
  "rank.factors.website.title": { def: "Your website & profile", max: 60 },
  "rank.factors.website.body": {
    def: "A profile that's complete and consistent, backed by real pages about the towns and services you cover.",
    max: 400,
  },
  "rank.keywords.label": { def: "Results by search term", max: 80 },
  "rank.keywords.title": { def: "What people are typing", max: 80 },
  "rank.keywords.sub": {
    def: "We track the most common searches separately, because you rank differently for each one.",
    max: 300,
  },
  "rank.geo.empty": {
    def: "Your first map check is being prepared — it'll appear here once it's run.",
    max: 200,
  },
  "rank.strongest.label": { def: "Where you're strongest", max: 60 },
  "rank.strongest.value": { def: "Ewa Beach, Kapolei & the whole west side", max: 120 },
  "rank.weakest.label": { def: "Where you're weakest", max: 60 },
  "rank.weakest.value": { def: "Honolulu and the windward side", max: 120 },
  "rank.pages.label": { def: "Your website", max: 60 },
  "rank.pages.title": { def: "The pages we've built for you", max: 100 },
  "rank.pages.sub": {
    def: "One page for each town we want you found in — plus service and guide pages as we go, based on what people are actually searching for.",
    max: 400,
  },
  "rank.systems.title": { def: "Behind the scenes", max: 60 },
  "rank.systems.sub": { def: "Everything running for you in the background", max: 120 },

  // ---- What I Need From You / your accounts ----
  // NOTE: passwords are never stored or shown here, by design — account
  // name, the sign-in email, and a link only.
  "ask.accounts.label": { def: "Your accounts", max: 60 },
  "ask.accounts.title": { def: "Where to check things yourself", max: 120 },
  "ask.accounts.lsa.name": { def: "Google Local Services Ads", max: 80 },
  "ask.accounts.lsa.what": { def: "Every lead Google sent you, and their messages", max: 200 },
  "ask.accounts.lsa.why": {
    def: "When Google hides a customer's name and number, this is where you reply to unlock them.",
    max: 300,
  },
  "ask.accounts.passwordNote": {
    def: "Passwords live in your own password manager, not in here.",
    max: 200,
  },

  // ---- Overview / junk-blocked card ----
  "overview.junk.title": { def: "Junk we kept off your phone", max: 80 },
  "overview.junk.sub": { def: "Robocalls and fake website inquiries that never reached you.", max: 200 },
  "overview.junk.empty": { def: "No junk to report yet.", max: 200 },
} as const satisfies Record<string, ContentEntry>;

export type ContentKey = keyof typeof LS_CONTENT;
