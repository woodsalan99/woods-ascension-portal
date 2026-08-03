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

// `max` guards layout, not brevity. A short label really does break a card
// if it runs long, so those stay tight; a body paragraph doesn't, so those
// are generous. The old prose limits were guesses that turned out to be far
// too tight the first time Alan wrote a real one. See D39.
export type ContentEntry = { def: string; max?: number } | { kind: "list"; def: string[]; maxItem?: number };

export const LS_CONTENT = {
  // ---- Overview / 30-second thesis ----
  "overview.thesis.summaryLabel": { def: "30-second summary of our campaign plan", max: 120 },
  "overview.thesis.intro": {
    def: "Our plan is simple. We bring in more leads through three things: **your website**, **Google Local Service Ads**, and **Google Maps**.",
    max: 1500,
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
  // Two paragraphs in one field: what Alan needs from the client, and what
  // Alan does in return. A blank line between them renders as a real
  // paragraph break — see the pre-line note in Editable.tsx.
  "overview.thesis.needs": {
    def: "__The core things I need from you:__ **respond to leads quickly (always)**, **follow up with them (always)**, **send me names and phone numbers for reviews (weekly)**, **share photos from your projects**, and **update the outcome of leads in the pipeline on an ongoing basis**.\n\n__On my end,__ the core things I'll do monthly that move this campaign forward are: adding 6 pages to the website, adding internal links and backlinks, reaching out to customers for reviews, posting photos to your listings, and keeping this portal up to date and sharing everything with you.",
    max: 1500,
  },
  "overview.thesis.expand": {
    def: "With that foundation in place, we'll keep seeing progress — and once it's working, we can expand into other things like Facebook ads.",
    max: 1500,
  },

  "overview.thesis.expandLabel": { def: "Expand", max: 30 },
  "overview.thesis.shrinkLabel": { def: "Shrink", max: 30 },

  // ---- Overview / hero (shown until a MonthlyWork row exists for the current month) ----
  "overview.hero.titleDefault": { def: "Welcome to your growth portal.", max: 150 },
  "overview.hero.subDefault": {
    def: "This is where you'll see your leads, your rankings, and everything we're building for you — updated as it happens.",
    max: 1500,
  },

  // ---- Overview / work block ----
  "overview.work.label": { def: "Work completed this month", max: 80 },
  "overview.work.title": { def: "What we built for you this month", max: 120 },
  "overview.work.sub": {
    def: "Some of this shows up in the numbers right away. Most of it takes a few months to pay off — but it's all getting done.",
    max: 1500,
  },
  "overview.work.empty": { def: "Nothing logged yet this month — check back soon.", max: 200 },
  // Rolling-window wording. Same block, different window — the copy has to
  // match what the numbers above it are actually counting.
  "overview.work.label.rolling": { def: "Work completed in the last 30 days", max: 80 },
  "overview.work.title.rolling": { def: "What we built for you in the last 30 days", max: 120 },
  "overview.work.empty.rolling": { def: "Nothing logged in the last 30 days — check back soon.", max: 200 },
  "overview.period.rolling": { def: "Last 30 days", max: 40 },
  "overview.period.mtd": { def: "This month so far", max: 40 },

  // ---- Overview / KPI card labels ----
  // A person who rings is a LEAD, never a "customer" — the portal has no
  // idea whether Bryan won the job, and calling them customers claims
  // something we cannot know. See D35.
  // The v8 mock rendered this as "Real customers who reached out / Leads" —
  // that slash was two candidate labels, not copy. Picked the plain one.
  "overview.kpi.leads.label": { def: "Real leads who got in touch", max: 100 },
  "overview.kpi.cpl.label": { def: "What each lead from Google Ads cost you", max: 100 },
  "overview.kpi.pages.label": { def: "Pages showing on Google", max: 100 },
  "overview.kpi.reviews.label": { def: "Your Google reviews", max: 100 },

  "overview.kpi.reviews.link": { def: "View on Google Maps →", max: 60 },

  // ---- Overview / latest leads ----
  "overview.needsYou.title": { def: "Latest leads", max: 60 },
  "overview.needsYou.sub": { def: "The most recent people who got in touch", max: 100 },
  "overview.needsYou.empty": { def: "No leads yet — they'll appear here the moment someone calls or fills in the form.", max: 200 },
  "overview.needsYou.hint": {
    def: "Tap a name to fix it or add a note. Anything you type here shows up on the Leads page too.",
    max: 200,
  },

  // ---- The Numbers ----
  "numbers.eyebrow": { def: "How it's going", max: 60 },
  "numbers.title": { def: "The numbers", max: 60 },
  "numbers.sub": {
    def: "Everything worth watching, in two groups. The \"healthy\" note under each one is what's realistic for a painter on Oahu — not a national average from a much bigger city.",
    max: 1500,
  },
  "numbers.adsMoved.title": { def: "Looking for your Google Ads numbers?", max: 80 },
  "numbers.adsMoved.body": {
    def: "They moved. They now sit with the map and the website on the rankings page, because all three are about the same thing — where people find you. This page is about what came in.",
    max: 1500,
  },
  "numbers.ads.title": { def: "Your Google ads", max: 60 },
  "numbers.ads.sub": { def: "The paid listings at the very top of Google", max: 120 },
  "numbers.customers.title": { def: "Your leads", max: 80 },
  "numbers.customers.sub": { def: "What's actually coming in, and where from", max: 120 },
  "numbers.outcomes.title": { def: "Jobs & reputation", max: 80 },
  "numbers.outcomes.sub": { def: "What happened after they got in touch", max: 120 },

  "numbers.adLeads.label": { def: "Leads from Google Ads", max: 80 },
  "numbers.adLeads.plain": { def: "People who called or messaged you straight from the paid listing at the top of Google.", max: 1500 },
  "numbers.adLeads.healthy": { def: "1–4 a month is what this market gives. There simply aren't many painting searches on Oahu each month.", max: 1500 },
  "numbers.adLeads.improve": { def: "Keep you first in line for every search there is|Dispute junk leads so you're not charged for them", max: 1500 },

  "numbers.cpl.label": { def: "What each ad lead cost", max: 80 },
  "numbers.cpl.plain": { def: "Google only charges when a real person contacts you — never for being seen. This is ad cost only, separate from our monthly fee.", max: 1500 },
  "numbers.cpl.healthy": { def: "$20–50 is healthy for painting. The national average is about $53, so you're paying well under half.", max: 1500 },
  "numbers.cpl.improve": { def: "Dispute junk leads so Google refunds them|Keep the settings tight to the work you actually want", max: 1500 },

  "numbers.impressions.label": { def: "Times your ad was seen", max: 80 },
  "numbers.impressions.plain": { def: "How many people on Oahu searched for a painter and saw your listing.", max: 1500 },
  "numbers.impressions.healthy": { def: "200–400 a month is simply how many people search here. It's a small island — this isn't a number we can push much higher.", max: 1500 },
  "numbers.impressions.improve": { def: "Keep every painting service switched on|Cover the whole island, available 24/7", max: 1500 },

  "numbers.topRate.label": { def: "How often you're shown first", max: 80 },
  "numbers.topRate.plain": { def: "When your ad shows up, this is how often you're the very first painter on the page — above every competitor.", max: 1500 },
  "numbers.topRate.healthy": { def: "Anything above 85% is strong. There is no higher spot to win.", max: 1500 },
  "numbers.topRate.improve": { def: "Answer or return every lead quickly|Keep new reviews coming in steadily", max: 1500 },

  "numbers.spend.label": { def: "Ad money spent", max: 80 },
  "numbers.spend.plain": { def: "What you actually paid Google this month. You only pay when someone contacts you.", max: 1500 },
  "numbers.spend.healthy": { def: "Money has never been what's holding this back — there simply aren't many searches to pay for. That's exactly why the website work matters.", max: 1500 },
  "numbers.spend.improve": { def: "Keep the unused budget rather than spending it for the sake of it|Look at other channels once the website work has matured", max: 1500 },

  "numbers.leads.label": { def: "Real leads who got in touch", max: 80 },
  "numbers.leads.plain": { def: "Actual homeowners wanting a quote for a job.", max: 1500 },
  "numbers.leads.healthy": { def: "4–10 a month is realistic today. This should climb as the town pages get onto Google.", max: 1500 },
  "numbers.leads.improve": { def: "Reach people outside Ewa Beach|Text back automatically on missed calls", max: 1500 },

  "numbers.organic.label": { def: "Leads that cost you nothing", max: 80 },
  "numbers.organic.plain": { def: "People who found you without you paying anything. These cost nothing per lead.", max: 1500 },
  "numbers.organic.healthy": { def: "This is the number the town pages are built to grow.", max: 1500 },
  "numbers.organic.improve": { def: "More pages, more reviews, more photos|Climb the map ranking across the island", max: 1500 },

  "numbers.jobs.label": { def: "Jobs won", max: 60 },
  "numbers.jobs.plain": { def: "Leads that turned into real paid jobs. We only know this once a lead is marked Job Won on the Leads page — the portal can see who got in touch, but not who said yes.", max: 1500 },
  "numbers.jobs.healthy": { def: "Roughly 1 in 3 quotes turning into a job is healthy for painting.", max: 1500 },
  "numbers.jobs.improve": { def: "Make sure every quote gets a follow-up|Get to new leads faster than competitors", max: 1500 },

  "numbers.reviews.label": { def: "Your Google reviews", max: 80 },
  "numbers.reviews.plain": { def: "When someone's comparing three painters, review count is usually what decides it.", max: 1500 },
  "numbers.reviews.healthy": { def: "2–4 new reviews a month is healthy. This is the single biggest thing holding your map ranking back.", max: 1500 },
  "numbers.reviews.improve": { def: "Ask every finished customer|One polite reminder if they don't reply", max: 1500 },

  // Status badges. These were hardcoded in the page — meaning Alan couldn't
  // edit them, and a card could still read "Excellent" while showing a dash
  // for a month with no data. Registry-backed now, and the page hides the
  // badge entirely when there's no number to judge. See D37.
  "numbers.adLeads.status": { def: "Normal", max: 30 },
  "numbers.cpl.status": { def: "Excellent", max: 30 },
  "numbers.impressions.status": { def: "Normal", max: 30 },
  "numbers.topRate.status": { def: "Excellent", max: 30 },
  "numbers.spend.status": { def: "Barely used", max: 30 },
  "numbers.leads.status": { def: "Normal", max: 30 },
  "numbers.organic.status": { def: "Growing", max: 30 },
  "numbers.jobs.status": { def: "On track", max: 30 },

  "numbers.chart.label": { def: "Since we started", max: 60 },
  "numbers.chart.title": { def: "Ad views and real leads, month by month", max: 120 },
  "numbers.chart.note": {
    def: "The grey bars are how many people saw your ad — they stay fairly flat, which tells us the size of the search market on Oahu. Underneath is how many people actually got in touch, split by whether they cost you anything. The free half is the one that keeps growing without costing more, and that ceiling on the bars is exactly why it matters.",
    max: 1500,
  },

  // ---- What I Need From You ----
  "ask.eyebrow": { def: "Your side of it", max: 60 },
  "ask.title": { def: "What I need from you", max: 80 },
  "ask.sub": {
    def: "Everything I need on your end, in one place — so you never have to dig through texts or emails to find it.",
    max: 1500,
  },
  "ask.now.title": { def: "Right now", max: 60 },
  "ask.now.sub": {
    def: "Things that will genuinely help right now. Tick them off, or type and upload straight into the boxes.",
    max: 1500,
  },
  "ask.habits.label": { def: "Every week", max: 60 },
  "ask.habits.title": { def: "The five things that actually bring in work", max: 100 },
  "ask.habits.sub": { def: "None of them take long, and they all add up.", max: 200 },
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
  "ask.reviews.title": { def: "Add a customer you'd like us to ask", max: 100 },
  "ask.reviews.sub": {
    def: "Drop a name in whenever you finish a job. We send the request and the follow-up — you don't do anything else.",
    max: 1500,
  },
  "ask.reviews.empty": { def: "Nobody on the list right now.", max: 150 },

  // ---- Where You Rank ----
  "rank.eyebrow": { def: "Google Maps", max: 60 },
  "rank.title": { def: "Where you rank", max: 80 },
  "rank.sub": {
    def: "Every month we check what position you come up in when someone searches from different spots around the island. Here's what we found.",
    max: 1500,
  },
  "rank.howToRead.title": { def: "How to read the map below.", max: 100 },
  "rank.howToRead.body": {
    def: "Think of the grid as Oahu. Each circle is a spot where someone might be standing when they pull out their phone and search. The number inside is where you came up in the list of painters — so **1 means you were the very first painter shown** to someone standing there. Green is good.",
    max: 1500,
  },
  "rank.whyVaries.title": { def: "Why the numbers are different in each spot.", max: 100 },
  "rank.whyVaries.body": {
    def: "You don't have one single position on Google. Where you show up changes depending on where the customer is searching from and how far that is from your business — someone in Ewa Beach sees a completely different list than someone in Kailua. That's why we check the whole island instead of just one place.",
    max: 1500,
  },
  "rank.monthStrip.label": { def: "Your average position, month by month", max: 100 },
  "rank.monthStrip.title": { def: "Are we improving?", max: 80 },
  "rank.monthStrip.sub": {
    def: "We run this scan every month and keep every one of them, so this line only gets longer. It's your average across every spot on the map and every search term we check — lower is better.",
    max: 1500,
  },
  "rank.monthStrip.footnote": {
    def: "The goal is to get that average under 5, which is roughly when you start appearing in the small map box at the top of Google without anyone having to scroll.",
    max: 1500,
  },
  // ---- Where You Rank / the three assets ----
  // The page is organised around the three places a homeowner can find you,
  // because that's the mental model — not around which tool reports it.
  "rank.core.label": { def: "The core pieces", max: 60 },
  "rank.core.sub": {
    def: "Three places a homeowner can find you. Each one is measured separately below, because you can be doing well in one and invisible in another.",
    max: 1500,
  },
  "rank.core.1": { def: "Google Maps", max: 40 },
  "rank.core.1.note": { def: "The map box that shows up first", max: 80 },
  "rank.core.2": { def: "Website", max: 40 },
  "rank.core.2.note": { def: "The pages people land on", max: 80 },
  "rank.core.3": { def: "Google Ads", max: 40 },
  "rank.core.3.note": { def: "The paid slots above everything", max: 80 },

  "rank.asset.subtitle": { def: "Where you show up", max: 60 },
  "rank.asset.maps.title": { def: "Asset #1: Google Maps", max: 60 },
  "rank.asset.web.title": { def: "Asset #2: Website", max: 60 },
  "rank.asset.ads.title": { def: "Asset #3: Google Ads", max: 60 },
  "rank.controls.title": { def: "What controls your position", max: 80 },

  // Website asset
  "rank.web.sub": {
    def: "Your own pages, and what people typed to reach them. This is the slowest of the three to move and the only one that keeps working without you paying for it.",
    max: 1500,
  },
  "rank.web.visits.label": { def: "Visits from Google", max: 60 },
  "rank.web.impressions.label": { def: "Times you appeared in search", max: 60 },
  "rank.web.pages.label": { def: "Pages showing on Google", max: 60 },
  "rank.web.trend.title": { def: "Visits from Google, month by month", max: 100 },
  "rank.web.keywords.title": { def: "What people typed to find you", max: 100 },
  "rank.web.keywords.sub": {
    def: "Your position in the normal (unpaid) Google results for each one. Lower is better — position 1 is the top of page one.",
    max: 1500,
  },
  "rank.web.keywords.empty": { def: "The keyword report lands at the end of the month.", max: 200 },
  "rank.web.pages.title": { def: "The pages we've built for you", max: 100 },

  // Ads asset
  "rank.ads.sub": {
    def: "The paid slots at the very top of Google. Fastest of the three to move, and the only one that stops the moment you stop paying.",
    max: 1500,
  },

  "rank.controls.maps.items": {
    kind: "list",
    maxItem: 500,
    def: [
      "Reviews|How many you have, how good they are, and how recently they arrived. A steady trickle beats a big burst.|Biggest one · you control this",
      "Photos|Google favours profiles with real, recent job photos going up regularly. Before-and-afters do best.|Biggest one · you control this",
      "Distance from the customer|The single biggest factor, and the one nobody controls. Being in Ewa Beach means you rank stronger nearby and weaker windward.|Nobody controls this one",
      "How fast you respond|Google watches how quickly calls and messages get answered, and ranks faster responders higher.|You control this",
    ],
  },
  "rank.controls.web.items": {
    kind: "list",
    maxItem: 500,
    def: [
      "Pages that match the search|One page per town and service, so there's something for Google to show whatever they typed.|We handle this",
      "Links pointing at those pages|Both from your own pages to each other, and from other websites. This is what makes Google trust them.|We handle this",
      "Time|New pages take months to earn their position. Nothing makes this part fast — it just compounds.|Nobody controls this one",
      "Reviews and photos|The same things that lift the map also lift the site, because Google reads them as signs of a real, active business.|You control this",
    ],
  },
  "rank.controls.ads.items": {
    kind: "list",
    maxItem: 500,
    def: [
      "Reviews|The main thing deciding which painter Google shows first in the paid slots.|Biggest one · you control this",
      "How fast you reply|Google demotes advertisers who are slow to answer, and promotes the ones who pick up.|You control this",
      "Google Guaranteed badge|Being licensed, insured and background-checked with Google is what qualifies you for these slots at all.|Already sorted",
      "Search volume on Oahu|The ceiling. Only so many people search for a painter here each month, and no budget changes that.|Nobody controls this one",
    ],
  },

  "rank.factors.label": { def: "What actually moves these numbers", max: 100 },
  "rank.factors.title": { def: "The things that decide your position", max: 120 },
  "rank.factors.sub": {
    def: "Google weighs a handful of things when it decides which painter to show first. Two of them are almost entirely in your hands.",
    max: 1500,
  },
  "rank.factors.reviews.tag": { def: "Biggest one · you control this", max: 40 },
  "rank.factors.reviews.title": { def: "Reviews", max: 40 },
  "rank.factors.reviews.body": {
    def: "How many you have, how good they are, and how recently they came in. A steady trickle beats a big burst — Google wants to see new ones arriving month after month.",
    max: 1500,
  },
  "rank.factors.photos.tag": { def: "Biggest one · you control this", max: 40 },
  "rank.factors.photos.title": { def: "Photos", max: 40 },
  "rank.factors.photos.body": {
    def: "Google favours profiles with real, recent job photos going up regularly. Before-and-afters do particularly well, and customers scroll them before they call.",
    max: 1500,
  },
  "rank.factors.photos.you": {
    def: "Send a few from every job — phone photos are completely fine.",
    max: 1500,
  },
  "rank.factors.distance.tag": { def: "Nobody controls this one", max: 40 },
  "rank.factors.distance.title": { def: "Distance from the customer", max: 60 },
  "rank.factors.distance.body": {
    def: "The single biggest factor, and the one nobody controls. Being based in Ewa Beach means you'll always rank stronger nearby and weaker on the windward side.",
    max: 1500,
  },
  "rank.factors.distance.you": {
    def: "This is why the town pages matter — they're how we tell Google you genuinely work across the whole island.",
    max: 1500,
  },
  "rank.factors.website.tag": { def: "We handle this", max: 40 },
  "rank.factors.website.title": { def: "Your website & profile", max: 60 },
  "rank.factors.website.body": {
    def: "A profile that's complete and consistent, backed by real pages about the towns and services you cover.",
    max: 1500,
  },
  "rank.keywords.title": { def: "Where You Show Up on Google Maps", max: 80 },
  "rank.keywords.sub": { def: "Results by search term", max: 1500 },
  "rank.keywords.note": {
    def: "We check each of these separately, because you rank differently for every one — and we run it again every month.",
    max: 1500,
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
    max: 1500,
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
    max: 1500,
  },
  "ask.accounts.passwordNote": {
    def: "Passwords live in your own password manager, not in here.",
    max: 200,
  },

  // ---- Monthly Recap ----
  "recap.eyebrow": { def: "Monthly recap", max: 60 },
  "recap.sub": { def: "What we did, what it produced, and what's coming next month.", max: 200 },
  "recap.headline.label": { def: "The headline", max: 40 },
  "recap.leads.title": { def: "Who got in touch", max: 60 },
  "recap.leads.sub": {
    def: "Every lead behind the number above. A lead is someone who contacted you — whether it turned into a paying job is only shown once it's marked won on the Leads page.",
    max: 1500,
  },
  "recap.did.title": { def: "What we did", max: 60 },
  "recap.next.title": { def: "What's coming next", max: 60 },
  "recap.note.label": { def: "A note from Alan", max: 60 },
  "recap.empty.title": { def: "Your first recap arrives at the end of the month.", max: 120 },
  "recap.empty.body": {
    def: "One short page each month: the headline of what actually happened, the numbers that go with it, and what's planned next — so you never have to wonder what you're paying for.",
    max: 1500,
  },
  "recap.kpi.leads": { def: "Real leads", max: 40 },
  "recap.kpi.jobs": { def: "Jobs won", max: 40 },
  "recap.kpi.value": { def: "Work value", max: 40 },
  "recap.kpi.spend": { def: "Ad spend", max: 40 },
  "recap.kpi.junk": { def: "Junk blocked", max: 40 },
  "recap.kpi.reviews": { def: "Reviews now", max: 40 },

  // The junk-blocked card was pulled from the Overview. The counting was
  // right, but the only thing it had ever counted was two of Alan's own
  // historical form tests and zero robocalls — a headline achievement made
  // of nothing. The `junk.blocked` resolver stays; bring the card back once
  // there's real volume behind it. See D40.
} as const satisfies Record<string, ContentEntry>;

export type ContentKey = keyof typeof LS_CONTENT;
