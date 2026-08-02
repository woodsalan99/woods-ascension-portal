# Canencia Portal — Build Handoff (FINAL)
## Adding a LOCAL_SERVICES client type to the Woods Ascension portal

**Companion file:** `canencia_portal_v8.html` — the approved working model. It is the
visual and behavioral spec for every client-facing page. Port it faithfully into the
app's component system; do not redesign it. Where its design tokens overlap the
existing `wa-*` CSS system, prefer the existing system.

**Reference:** the technical audit already performed on this codebase (stack, data
model, integration patterns, extensibility). Its findings are assumed below.

**All decisions are resolved.** There are no open questions in this document.

---

## 0. Ground rules

1. Read `MASTER_BUILD_SPEC.md` first. Schema changes follow the §12 change protocol.
   After migration, update the §5 schema mirror.
2. Work on a branch (`local-services`). Take a full Postgres dump before any migration.
3. **Nothing changes for COLD_EMAIL clients.** Every new behavior is gated on
   `Client.type`. Existing nav, pages, metrics, and sync are untouched for them.
4. Propose the Phase 1 migration as a reviewable diff BEFORE running anything.
5. The mock's JavaScript is prototype logic. Port the *behavior*; implement with the
   app's real patterns (server components, server actions, Prisma).

---

## 1. Core architectural decisions

### 1.1 ClientType
Add `type ClientType @default(COLD_EMAIL)` to `Client`
(`enum ClientType { COLD_EMAIL LOCAL_SERVICES }`). Drives: sidebar nav config,
route guards, which cron jobs process the client, which template sets apply.

### 1.2 MetricKey enum → String
Migrate `MetricKey` from a Postgres enum to `String` on `MetricConfig` and
`TemplateMetricConfig`. Existing values migrate as-is. New metric types become data,
not schema. Mechanical but touches dashboard-compute, the metrics page, and the
admin metric-config UI — do it first, in isolation, with its own migration.

### 1.3 The content registry — "everything editable," by construction
The most important system in the build.

- `src/content/localServices.ts` — a registry of **every client-facing string** on
  local-services pages: stable namespaced key → default copy.
  Examples: `overview.hero.title`, `overview.thesis.p1`, `overview.thesis.item.website`,
  `rank.explainer.body`, `ask.habits.photos.why`, `numbers.lsaLeads.healthyRange`.
- `PortalContent` stores per-client overrides: `{ clientId, key, value, updatedAt }`.
  Resolution: `override ?? registryDefault`.
- An `<Editable k="...">` component renders every registry string. In admin edit
  mode it becomes contenteditable; otherwise it renders plain.
- **Hard rule: no hardcoded client-facing strings in local-services pages.** If a
  string renders, it goes through `<Editable>`. The v8 mock used selector-scanning
  and missed elements (thesis paragraphs containing `<b>` children); the registry
  approach cannot miss anything because editability is a property of rendering,
  not discovery.
- Multi-paragraph blocks get one key per paragraph / list item. Lists whose
  *length* Alan may change (thesis bullets, weekly habits) store an ordered JSON
  array under one key.

### 1.4 Two-tier editing
- **Copy tier** (everything in the registry): freely editable in edit mode.
- **Data tier** (numbers produced by data resolvers — synced, computed, or
  admin-entered): rendered locked. Clicking prompts the unlock confirmation (field
  name, current source value, last-pulled time, explicit checkbox). Confirming
  writes a `MetricOverride`; the resolver returns the override while active. Admin
  view shows an "overridden — live value is X" badge with one-click reset.
- **No autosave in edit mode.** Changes accumulate client-side → Save opens a diff
  review (old → new, grouped by page/card; data-tier overrides flagged separately)
  → "Publish changes" commits in one transaction via server action. Discard
  reverts. Paste stripped to plain text; zod-validated server-side (plain text,
  length caps per key class).
- Client task submissions (§4.2) are a different system and DO autosave — that is
  intentional; do not conflate the two.

### 1.5 Integrations & credentials
`ClientIntegration { id, clientId, provider, config Json, credentials Bytes(encrypted),
status, lastSyncAt, lastError? }`. Providers: `CALLRAIL`, `GMAIL`, `GSC`,
`GOOGLE_PLACES`. AES-GCM with `ENCRYPTION_KEY` env (small crypto helper; never
plaintext). **No self-serve OAuth UI.** Alan performs one-time consent per client
manually (an admin-only helper route to complete the flow and store the refresh
token is fine); the app only refreshes tokens.

### 1.6 Sync pattern
Copy `/api/cron/sync` conventions exactly: `CRON_SECRET` bearer guard, one
`SyncRun` row per attempt (add a `source` discriminator), self-heal for stuck
RUNNING rows, per-client loop over active LOCAL_SERVICES clients with the relevant
integration. Separate routes, separate Railway cron entries:

| Route | Cadence | Job |
|---|---|---|
| `/api/cron/sync-callrail` | */15 min | calls → CallRecord → leads |
| `/api/cron/sync-gmail` | */5 min | LSA + estimate-request emails → leads → Pushover |
| `/api/cron/sync-gsc` | daily | clicks/impressions + URL Inspection index status |
| `/api/cron/sync-places` | daily | review count / rating / recent reviews |

---

## 2. Schema — new models

Names indicative; follow existing conventions (cuid ids, clientId FKs + indexes,
`@@unique` where noted). All client-scoped.

```prisma
enum ClientType { COLD_EMAIL LOCAL_SERVICES }

enum LeadSource { LSA GBP_CALL WEBSITE_FORM REFERRAL OTHER }
enum LeadStage  { NEW CONTACTED QUOTE_SENT JOB_SCHEDULED JOB_WON
                  REVIEW_REQUESTED REVIEW_COMPLETE LOST }

model ServiceLead {
  id, clientId, source LeadSource, stage LeadStage @default(NEW)
  name String?          // null for LSA naked leads ("Potential Customer" parses to null)
  phone String?, email String?
  location String?      // city (LSA gives city only)
  address String?       // full project address (form emails provide it)
  serviceType String?, message String?
  qualified Boolean?    // null = unreviewed; the qualified toggle
  needsDetails Boolean @default(false)   // LSA: name/phone hidden until reply
  jobValue Int?         // entered ONLY at JOB_WON (modal on drop; UI enforces)
  callRecordId?, formSubmissionId?       // provenance
  callRailUrl String?, recordingUrl String?
  nextActionLabel String?, nextActionAt DateTime?
  receivedAt DateTime, stageChangedAt DateTime
}
model LeadNote     { id, leadId, authorUserId, body, createdAt }
model LeadActivity { id, leadId, type String, meta Json?, createdAt }
  // stage moves, notes, touches → powers "followed up this week"

model CallRecord {
  id, clientId, callRailId String @unique, occurredAt, durationSec Int
  callerNumber, trackingNumber, keypress String?   // IVR result
  classification String   // QUALIFIED | ROBOCALL | SPAM | WRONG_AREA | UNKNOWN
  forwarded Boolean, recordingUrl String?, raw Json
}
model FormSubmission {
  id, clientId, receivedAt, name?, phone?, email?, address?, message?
  spamVerdict Boolean?, spamConfidence Float?, spamReason String?
  passedOn Boolean, raw Json     // raw = parsed email body + gmail message id
}

model LsaMonthlyStat {           // manual admin entry, indefinitely
  clientId, month String         // "2026-07"
  impressions Int, topRatePct Float, absTopRatePct Float
  spendCents Int, chargedLeads Int
  @@unique([clientId, month])
}
model GscDailyStat { clientId, date, clicks Int, impressions Int @@unique([clientId,date]) }
model SitePage {                 // town pages; manual add on publish
  id, clientId, url, town String, publishedAt
  indexed Boolean @default(false), indexedAt?, lastCheckedAt?
}

model ClientLocation { id, clientId, name, isPrimary Boolean }  // Pamalu multi-GBP, day one
model GeogridScan {              // manual monthly upload, 3–5 keywords/client
  id, clientId, locationId, keyword String, month String
  gridJson Json, avgRank Float, top3Pct Float   // computed on upload
  takenAt DateTime
  @@unique([clientId, locationId, keyword, month])
}
model KeywordRank {              // Ahrefs CSV import, monthly
  clientId, month, keyword, volume Int?, position Int, prevPosition Int?, url
  @@unique([clientId, month, keyword])
}

model ReviewSnapshot { clientId, date, count Int, rating Float @@unique([clientId,date]) }
model ReviewItem     { id, clientId, author, rating Int, text, reviewedAt }
model ReviewRequest {
  id, clientId, leadId?, customerName, phone, jobFinishedAt
  status String  // QUEUED | SENT | REMINDED | REVIEWED | DEAD
  sentAt?, remindAt?
}
  // v1 workflow: portal queues + notifies Alan; Alan sends the text himself.

model ClientTask {               // What I Need From You
  id, clientId, title, explanation, urgency String
  responseType String            // CHECK | TEXT | PHOTO | BOTH
  status String @default("OPEN"), sortOrder Int, completedAt?
}
model TaskSubmission {           // client input — autosaves
  id, taskId, kind String        // TEXT | PHOTO
  textValue String?, fileUrl String?
  submittedByUserId, createdAt, notifiedAt?
}

model WorkLog {                  // Alan's during-month quick log → recap builder autofill
  id, clientId, body, createdAt, source String  // ADMIN_NOTE | SYSTEM
}
model MonthlyWork {              // SINGLE SOURCE: Overview work block + recap list
  id, clientId, month String
  heroTitleAuto?, heroSubAuto?         // AI-generated from month data
  heroTitleManual?, heroSubManual?     // manual wins when set
  items Json    // [{ title, detail, recap }]
  noteFromAlan?, nextMonth Json
  @@unique([clientId, month])
}

model PortalContent  { clientId, key String, value String, updatedAt @@unique([clientId,key]) }
model MetricOverride {
  id, clientId, scopeKey String        // e.g. "lsa.cpl:2026-07"
  value String, originalValue String, active Boolean @default(true), createdAt
}

model NotificationChannel {
  id, clientId?, userId?               // client-level or per-person
  channel String                       // PUSHOVER | EMAIL | SMS
  address String                       // pushover user key / email / phone
  active Boolean @default(true)
}
model Notification { id, clientId, kind String, payload Json, createdAt, deliveredAt?, error? }
```

---

## 3. Data flows

### 3.1 CallRail (live)
Fetch wrapper templated off `src/lib/smartlead.ts` (same shape, pagination, rate
delays). Per sync: pull calls since cursor → upsert `CallRecord` → classify
(keypress present → QUALIFIED; no keypress on IVR line → ROBOCALL; LSA line
bypasses IVR → QUALIFIED; duration < 20s flags for review, never auto-deletes) →
QUALIFIED calls create/update a `ServiceLead` with recording URL + CallRail link.
Recordings play **in-portal** for client users via a proxy route that fetches from
CallRail with the API key (confirmed: clients may listen).

### 3.2 Gmail ingestion — ONE pipeline, TWO parsers (live)
OAuth on Alan's inbox `woodsalan99@gmail.com` (gmail.readonly), one-time manual
consent, refresh token in `ClientIntegration`. Poll every 5 minutes; track last
processed message id/historyId as cursor. Two matchers:

**A. LSA notification emails**
- Subject/heading: `Potential Customer's sent you a new request`
- Parse: received datetime; Name (literal `Potential Customer` → `name = null`);
  Location (city); Service type; Message. Phone almost always absent →
  `needsDetails = true`, card shows "Name & number in Google" + LSA deep link.
- → `ServiceLead` (source LSA) → Pushover to client + Alan. This mechanism
  replaces Google's unreliable notifications and is the reason for the 5-min cadence.

**B. Website estimate-request emails (Lovable site, current format)**
- From: `noreply@oahuhousepainters.com` · Subject: `New estimate request - {Name} ({City})`
- Body fields (labeled, in order): NAME · PHONE · EMAIL · PROJECT ADDRESS
  (street line + "City, ST, ZIP" line) · WHAT THEY NEED · footer:
  `Submitted: {datetime} HST`, `Page: {path}`, `Site: {url}`.
- Parse all fields (address → `ServiceLead.address`, city → `location`) →
  spam classification (§3.3) → `FormSubmission` → if real, `ServiceLead`
  (source WEBSITE_FORM) → Pushover. Spam is stored, counted, never forwarded.
- Parser matches on labeled fields, not layout; tolerate the "Massage"/"Message"
  label variant for any legacy Webflow messages encountered during backfill.

**Watchdog:** if a LOCAL_SERVICES client produces zero form-derived
`FormSubmission` rows (including spam) in 7 days, notify Alan. This failure mode
(Lovable silently not sending) already cost two months of leads once.

### 3.3 Spam classification (Claude API)
Server-side (haiku-class model, `ANTHROPIC_API_KEY`). Strict JSON out:
`{ qualified, confidence, reason }`. Spam signals: pitching *to* the business;
SEO/marketing/lead-gen offers; addressing the domain not a person; "Reply YES"
CTAs; patterned/fake phone; empty location. Low-confidence → flag for Alan's
review, don't silently bin. **Log all spam; never delete** — blocked counts render
on the Overview.

### 3.4 GSC (live)
Search Analytics API for daily clicks/impressions (API backfills ~16 months —
July history is free). URL Inspection API per `SitePage` daily → `indexed`.
OAuth refresh token per client, manual one-time consent.

### 3.5 Google Places (live)
Daily: review count + rating → `ReviewSnapshot`; five most recent → `ReviewItem`.

### 3.6 Manual admin entry (indefinitely)
Admin forms on the existing server-action pattern:
- **LSA monthly stats** (impressions, top %, abs-top %, spend, charged leads).
- **Geogrid upload**: location + keyword + month + Local Falcon export (CSV/JSON);
  `avgRank`/`top3Pct` computed server-side. Rankings month-strip = blended average
  across all keywords × locations for the month. **History starts August 2026 —
  no geogrid backfill; the strip must render gracefully with a single month.**
- **Ahrefs CSV import** → `KeywordRank`.
- **SitePage add** when a town page ships.
- **WorkLog quick-add** (one text field, ubiquitous in admin) → recap autofill.

### 3.7 Monthly recap assembly
Builder (admin-only, per mock): autofill from `WorkLog` + system events (pages
indexed, geogrid deltas, review counts, spam totals) with checkboxes + the five
questions. Writes `MonthlyWork` — **one input rendering two surfaces** (Overview
"What we built" + recap "What we did"); they cannot drift. Hero: Claude API
generates `heroTitleAuto/SubAuto` from month data; manual fields win when set;
Auto-written / Written-by-you tag with reset, per mock. "Download PDF" = print
stylesheet, v1.

---

## 4. Pages (port from `canencia_portal_v8.html`)

Nav for LOCAL_SERVICES (order): Overview · What I Need From You (open-count badge)
· Leads · Where You Rank · The Numbers · Monthly Recap · Documents.
`NAV_ITEMS` becomes per-ClientType config. Route guards both directions.

**4.1 Overview** — date pill computed "MonthName 1 – MonthName {today}". Hero from
`MonthlyWork` (auto/manual). 30-second thesis: collapsible, default open, centered,
gold italic serif; **every paragraph and bullet a registry key**. Work block from
`MonthlyWork.items`. KPI cards from resolvers (real/junk split bars). Needs-
attention queue (leads with due/overdue `nextActionAt`). Junk-blocked card with
source split.

**4.2 What I Need From You** — tasks from `ClientTask`, collapsed by default
(title + urgency), expand on tap. Subtitle: "Specific things that will move the
campaign forward. Tick them off, or type/upload straight into the boxes."
TEXT tasks: paragraph textarea, debounced autosave → `TaskSubmission`, save-state
indicator, Pushover to Alan on first meaningful save. PHOTO tasks: presigned
upload to **Cloudflare R2** (decided), thumbnails, delete, notify; store full
resolution (photos feed the Google profile). Admin task editor (title, explanation,
response type, urgency). Weekly-habits section (registry). Review request box →
`ReviewRequest` QUEUED + notify Alan (v1: Alan sends the text himself). Accounts
table — **never store or render passwords**; display stays as designed
(`canenciapainting@gmail.com` is the Alan-managed login and is correct to show).

**4.3 Leads** — 8-column kanban. Drag persists via server action + `LeadActivity`.
Drop on JOB_WON opens the job-value modal (only place value is asked). LSA
naked-lead card state (italic name, amber needs-details strip, LSA deep link).
In-portal recording playback on call-sourced cards. Qualified toggle. Notes on
card tap. Stats strip computed: open = first four stages; touched = `LeadActivity`
in 7 days; won $ = sum `jobValue` for JOB_WON in month.

**4.4 Where You Rank** — explainer strips (registry, incl. position-varies-by-
searcher-location paragraph). Month strip: blended avg per month (starts with
August only — single-cell render must look intentional, not broken). Ranking-
factors section (four cards, registry copy, live where-you-stand values). Keyword
tabs → `GeogridScan` render (rank-band colors per mock). Location switcher enabled
when >1 `ClientLocation`. GSC stats card. Pages-built list from `SitePage`.
Behind-the-scenes system cards — **status pills live**, from `ClientIntegration`
status + last sync/error, not hardcoded.

**4.5 The Numbers** — two sections only (Google Ads / Customers & Reputation),
cards per mock incl. "Total leads from Google Ads" and free-vs-paid split; every
label, plain-English line, healthy range, and improvement bullet a registry key;
every number a resolver (override-capable). No junk metrics here. No Facebook
timeline — open-ended phrasing only. Chart: **new component**; do NOT reuse
`ActivityChart`.

**4.6 Monthly Recap** — render from `MonthlyWork` + month stat grid (resolvers).
Month navigation. Print-stylesheet PDF. Builder per §3.7.

**4.7 Documents** — reuse existing Document model/page as-is.

---

## 5. Notifications (decided)

**Primary channel: Pushover.** `PUSHOVER_APP_TOKEN` env; user keys in
`NotificationChannel` rows — one for Alan, one for the client account Bryan &
Desiree already have installed. Simple POST to api.pushover.net; ~20 minutes of work.

Triggers:
- **New qualified lead** (any source; LSA highest priority — this replaces
  Google's broken notifications) → client Pushover + Alan Pushover.
- **TaskSubmission created** (text or photos from Bryan/Desiree) → Alan Pushover.
- **Form watchdog trip / integration sync failure** → Alan Pushover.
- **ReviewRequest queued** → Alan Pushover.

Email (Alan `woodsalan99@gmail.com`, Desiree `canencia.painting15@gmail.com`)
is the fallback channel — implement the `EMAIL` NotificationChannel type but it
can ship after Pushover. Clerk invites for Bryan & Desiree use their real emails.

**SMS (fast-follow, NOT in this build):** Twilio requires US A2P 10DLC campaign
registration with days-to-weeks of carrier approval before production sends. Stub
the `SMS` channel type in `NotificationChannel` so it slots in later; do not block
on it.

Every `Notification` row records delivery result (`deliveredAt` / `error`).

---

## 6. Export / Import

Admin-only, per client. **Export**: server action serializes all client-scoped
rows (every §2 table + `PortalContent` + `MetricOverride` + leads/notes/
submissions) into a versioned JSON envelope (`version: 1`, `exportedAt`,
`client`); R2 file fields exported as URLs. Download + counts preview per mock.
**Import**: upload → zod-validate against envelope version → preview (client,
taken-at, counts) → explicit checkbox → transactional replace of client-scoped
data. Registry keys and stable record ids are what make an October export restore
correctly later — **never key anything positionally**.

---

## 7. Build order — each phase ends reviewable and shippable

**Phase 1 — Schema + gating.** All §2 models; MetricKey→String migration;
`ClientType`; nav/route gating; Canencia client row + Clerk invites (Desiree:
canencia.painting15@gmail.com; Bryan's email supplied at invite time).
*Done when:* migrations clean; cold-email clients unchanged; Canencia login shows
an empty local-services shell.

**Phase 2 — Content system + edit mode, proven on Overview.** Registry,
resolution, `<Editable>`, edit toggle, diff-save, `MetricOverride` unlock flow,
static Overview port. *Done when:* every visible Overview string is editable
(including every thesis paragraph); a copy edit and a data override both survive
reload; discard works; nothing autosaves.

**Phase 3 — Leads vertical.** CallRail integration + cron; Gmail ingestion with
both parsers + cron; spam classification; Pushover delivery; kanban with
drag/notes/qualified/job-value modal. *Done when:* a real call, a real form
submit, and a real LSA email each land as correctly-shaped leads and fire
Pushover to both accounts; robocalls and spam are logged, counted, invisible to
the client; the watchdog fires on a simulated silent week.

**Phase 4 — Rankings + Numbers + manual entry.** GSC + Places syncs; admin forms
for LSA stats / geogrid / Ahrefs / SitePage; both pages ported live. *Done when:*
Alan uploads an August geogrid and it renders with computed averages in a
one-month strip; Numbers shows real LSA figures (July: 293 impressions, $22.11,
1 charged lead).

**Phase 5 — What I Need From You + Monthly Recap.** Tasks + submissions + R2
uploads + Pushover; WorkLog; recap builder; MonthlyWork single-source render; AI
hero with manual override. *Done when:* text typed by a client persists and pings
Alan's phone; editing MonthlyWork once updates Overview and Recap together.

**Phase 6 — Export/Import + backfill + launch.** Backup/restore round-trips
byte-faithfully on a copy; July backfill (CallRail + GSC automatic; LSA May–July
manual: 202/336/293 impressions, $0/$39.32/$22.11, 0/2/1 charged leads); watchdog
armed; copy pass; mobile pass (Bryan is phone-first).

---

## 8. Do-nots

- No self-serve OAuth UI. No Google Ads API for LSA (manual entry, indefinitely).
- No visible change for COLD_EMAIL clients.
- No autosave anywhere in admin edit mode.
- No plaintext credentials; no passwords stored or displayed anywhere.
- Don't force local-services data into `DailyStat`; don't reuse `ActivityChart`
  or `Campaign` — build siblings.
- No selector-scanned editability; registry only.
- No hardcoded client-facing strings on local-services pages.
- Job value asked at JOB_WON only — nowhere else.
- Spam is logged, never deleted.
- LSA-sourced calls never pass through the IVR (routing configured in CallRail by
  Alan; the sync respects the classification).
- No Twilio/SMS in this build — Pushover only; SMS is a stubbed channel type.

## 9. Kickoff prompt for Claude Code

> Read `CANENCIA_PORTAL_HANDOFF.md` in full, then `MASTER_BUILD_SPEC.md` (§5, §12,
> D5, D8), then open `canencia_portal_v8.html` — the approved client-facing spec.
> All decisions are final; do not reopen them. Start with Phase 1 only: propose
> the complete Prisma schema diff and migration plan (including the MetricKey
> enum→String conversion and everything it touches) as a reviewable plan. Do not
> run migrations, do not touch nav/pages/components until the schema plan is
> approved.
