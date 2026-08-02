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
