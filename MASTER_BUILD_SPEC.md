# WOODS ASCENSION CLIENT PORTAL — MASTER BUILD SPEC
**Version 1.0 · Created 2026-07-09 · Owner: Alan Woods**

---

## §0 — HOW TO USE THIS DOCUMENT (read first, every session)

This is the single source of truth for the Woods Ascension Client Portal build. It is designed to be uploaded to any new Claude instance (chat or Claude Code) so the build continues exactly where it left off.

**Session protocol:**
1. At session start, Alan uploads this document plus the current codebase (GitHub repo link if public, or a zip of the repo).
2. The instance reads §6 (Module Status Tracker) to find the current state, then §2 (Locked Decisions) and §3 (Scope Contract) before writing any code.
3. Never re-litigate a Locked Decision. If something forces a change, follow the Change Protocol in §12.
4. At session end, the instance MUST output an updated copy of this document with: the Module Status Tracker updated, any new decisions appended to §2, and the version number incremented (1.0 → 1.1). Alan saves it and uses it to open the next session.
5. If code exists that contradicts this document, the document wins unless the tracker says otherwise — flag the conflict to Alan before proceeding.

**Prime directives for every instance:**
- Ship, don't gold-plate. v1 scope is frozen (§3). New ideas go to the v2 Backlog (§14), never into the sprint.
- The client-facing portal must be beautiful (design system in §9, approved demo artifact is the visual spec). The admin panel must be functional and ugly-fast.
- Multi-tenant correctness is the one non-negotiable quality bar. See §6, Module B.

---

## §1 — MISSION & PRODUCT PRINCIPLES

**What this is:** A login-gated, multi-client web portal at `portal.woodsascension.com` where Woods Ascension's cold-email clients see their campaign performance, milestones, onboarding progress, pipeline, booked appointments, and a weekly note/video from Alan.

**Why it exists (in priority order):**
1. **Perception** — clients experience Woods Ascension as a polished, professional operation.
2. **Confidence** — clients always see progress; they are never confused about status, especially in slow early weeks. Empty states and milestone framing are features, not gaps.
3. **Contract alignment** — the portal visualizes the client's actual contractual journey (e.g., Zoom Business Brokers' Day 111 review), turning the portal into a sales instrument for the post-review pricing conversation.

**Product principles:**
- Portal reads only from our own database — never from Smartlead live.
- Everything client-visible is per-client configurable (stage labels, milestones, onboarding steps) so any future client fits without code changes.
- Manual inputs (pipeline, notes) are part of the product; the weekly 15-minute update ritual keeps the portal alive.

---

## §2 — LOCKED DECISIONS (ADR log — append only)

| # | Decision | Rationale | Date |
|---|---|---|---|
| D1 | Stack: Next.js (App Router, TypeScript) + Prisma + PostgreSQL + Tailwind + Recharts | Same stack as Alan's health dashboard; known failure modes | 07-09 |
| D2 | Hosting: Railway — NEW isolated project + NEW Postgres instance (not shared with health dashboard) | Product isolation; a bad migration in one product can't kill the other | 07-09 |
| D3 | Auth: Clerk, magic-link (email link) sign-in, invite-only. No public signup. No custom auth ever. | Zero password-support burden; Clerk free tier covers ~10K MAU | 07-09 |
| D4 | Roles: ADMIN (Alan only) and CLIENT (scoped to one clientId). One client-side user per client for v1. | Simplicity; contract contact is single (Jim) | 07-09 |
| D5 | Sync: cron pull every 1–2 hours into `DailyStat`. NO webhooks in v1 (v2 backlog). | Sidesteps rate limits; hourly freshness exceeds client expectations | 07-09 |
| D6 | Positive replies: auto-derived from Smartlead lead categories (Alan categorizes daily). Admin override exists per entry. | Matches Alan's real daily habit | 07-09 |
| D7 | Day boundary: timestamps stored UTC; daily aggregates bucketed by CLIENT's timezone, stored on Client record. Zoom Business Brokers = `America/Los_Angeles` (Pacific — NOT Eastern). | California client; timezone drift is the classic daily-chart bug | 07-09 |
| D8 | Pipeline stage LABELS are per-client config; stage KEYS are fixed enum: STAGE_1..STAGE_4. Zoom labels: Positive Reply → Appointment Booked → Appointment Held → Listing Signed. | Repurposable across lending/M&A clients without schema changes | 07-09 |
| D9 | Video notes: store any URL (Loom, YouTube unlisted, etc.); render Loom/YouTube as embeds, other URLs as a styled link card. | Alan has Loom but wants flexibility | 07-09 |
| D10 | Campaign mapping: one Client → many Smartlead campaigns (Zoom will have 3–4). DailyStat aggregates across all linked campaigns. | Matches real campaign structure | 07-09 |
| D11 | Qualified-appointment tracking: `PipelineEntry.qualified` boolean + `disqualifiedReason` — mirrors contract Section 5 billable criteria. Portal shows qualified counts; billing math stays OUT of v1. | Contract alignment without building invoicing | 07-09 |
| D12 | Domain: `portal.woodsascension.com` via CNAME on Hostinger DNS → Railway. | Alan has full Hostinger access | 07-09 |
| D13 | DB seed includes TWO clients: Zoom Business Brokers (real) + "Meridian Demo Co." (staging/sales-demo, fake data). Built day one; doubles as the tenancy leak test. | One more client expected within 30 days; demo login for prospect calls | 07-09 |
| D14 | Launch state: Zoom seeds with EMPTY pipeline stages and onboarding at Week-0 state (setup paid ✓, everything else pending). Campaign launches during onboarding — backfill not needed at launch; sync begins when campaigns are linked. | Contract signed 07/08; Day 0 = setup invoice payment | 07-09 |
| D15 | User provisioning: admin invite action calls Clerk's Invitations API with `{role, clientId}` in `publicMetadata`; a Clerk webhook (`/api/webhooks/clerk`, `user.created`) upserts the `User` row on accept. No nullable `clerkId`, no separate pending-invite table — schema stays exactly as §5. | Keeps `User.clerkId`/`email` required as specified while still supporting invite-before-signup; avoids a schema change for something the Change Protocol would otherwise flag | 07-09 |
| D16 | Positive-reply classification (§7): a lead's reply counts as positive when its Smartlead `lead_category` name has `sentiment_type: "positive"` in the account's live `/leads/fetch-categories` list — not a hardcoded name/ID list. | The account has 20+ custom categories (`Alan - Booked`, `AFC - Qualified`, etc.) beyond the spec's example names; `sentiment_type` already encodes the positive/neutral/negative classification Alan sets per category in Smartlead, so deriving from it is more robust than hardcoding "Interested"/"Meeting Request" and self-updates if Alan adds categories later | 07-09 |

---

## §3 — V1 SCOPE CONTRACT

**IN (v1 = the approved demo artifact, multi-tenant, on real data):**
- Magic-link login, invite-only, admin + client roles
- Client dashboard: KPI row · daily activity chart (sends / positive replies / bounces / booked markers) · milestone journey rail · onboarding checklist with CTAs · pipeline columns with entries & values · upcoming appointments list · note-from-Alan card (text + video)
- Week-appropriate empty states (verbatim from demo)
- Smartlead cron sync → DailyStat
- Admin panel (unstyled/shadcn): client CRUD, campaign linking, pipeline manager, milestone editor, onboarding step manager, weekly note composer, positive-reply override
- Two seeded clients (Zoom + Meridian Demo)
- Deployed at portal.woodsascension.com

**OUT (v2 backlog — do not build, do not discuss in-session):**
Webhooks · Pushover/failure alerting · client notifications/emails · billing & invoicing math · PDF exports · client-side editing · multi-user clients · white-labeling · deliverability views · analytics on portal usage · Slack integration · anything else new.

---

## §4 — ARCHITECTURE

```
Browser (client or admin)
   │  Clerk magic-link auth
   ▼
Next.js App (Railway)
   ├── /            → client dashboard (role CLIENT, scoped to their clientId)
   ├── /admin/*     → admin panel (role ADMIN only)
   ├── /api/cron/sync → Smartlead sync (Railway cron hits this; guarded by CRON_SECRET header)
   ▼
PostgreSQL (Railway, dedicated instance)
   ▲
Smartlead REST API  ←– cron pull only (analytics + lead categories per linked campaign)
```

- All reads on the dashboard come from Postgres. Smartlead is touched only by the cron route.
- Tenancy: a single helper `getScopedContext()` resolves session → { role, clientId }. Every data-access function requires clientId as a parameter. No query in client-facing code may omit it. Admin routes verify role in the `/admin` layout.

---

## §5 — DATA MODEL (Prisma schema, authoritative)

```prisma
enum Role { ADMIN CLIENT }
enum StageKey { STAGE_1 STAGE_2 STAGE_3 STAGE_4 }
enum StepState { DONE CURRENT ACTIVE NEXT }
enum MilestoneState { DONE CURRENT NEXT }

model Client {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  timezone      String   // IANA, e.g. "America/Los_Angeles"
  status        String   @default("ACTIVE") // ACTIVE | PAUSED | ARCHIVED
  stageLabels   Json     // { STAGE_1: "Positive Reply", STAGE_2: "Appointment Booked", ... }
  calendarLink  String?
  intakeFormLink String?
  launchDate    DateTime?
  heroName      String?  // display name in portal header
  createdAt     DateTime @default(now())
  users         User[]
  campaigns     Campaign[]
  dailyStats    DailyStat[]
  pipeline      PipelineEntry[]
  milestones    Milestone[]
  onboarding    OnboardingStep[]
  notes         WeeklyNote[]
}

model User {
  id        String  @id @default(cuid())
  clerkId   String  @unique
  email     String  @unique
  role      Role
  clientId  String?
  client    Client? @relation(fields: [clientId], references: [id])
}

model Campaign {
  id                  String  @id @default(cuid())
  clientId            String
  client              Client  @relation(fields: [clientId], references: [id])
  smartleadCampaignId String  @unique
  name                String
  active              Boolean @default(true)
}

model DailyStat {
  id              String   @id @default(cuid())
  clientId        String
  client          Client   @relation(fields: [clientId], references: [id])
  date            DateTime // date-only, client-TZ bucket, stored as UTC midnight
  sends           Int      @default(0)
  totalReplies    Int      @default(0)
  positiveReplies Int      @default(0)
  bounces         Int      @default(0)
  apptsBooked     Int      @default(0) // manual, derived from PipelineEntry counts by admin action or nightly rollup
  @@unique([clientId, date])
}

model PipelineEntry {
  id                 String    @id @default(cuid())
  clientId           String
  client             Client    @relation(fields: [clientId], references: [id])
  stage              StageKey
  contactName        String
  company            String
  dealValue          Int?      // whole dollars; null allowed
  notes              String?
  callDateTime       DateTime?
  callStatus         String?   // CONFIRMED | PENDING | HELD | NO_SHOW
  qualified          Boolean   @default(true)
  disqualifiedReason String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}

model Milestone {
  id           String         @id @default(cuid())
  clientId     String
  client       Client         @relation(fields: [clientId], references: [id])
  label        String
  subLabel     String?        // e.g. "Day 21" or "3 of 5"
  state        MilestoneState
  targetValue  Int?
  currentValue Int?
  sortOrder    Int
}

model OnboardingStep {
  id        String    @id @default(cuid())
  clientId  String
  client    Client    @relation(fields: [clientId], references: [id])
  label     String
  dayLabel  String    // "Day 0", "Days 1–3"
  state     StepState
  ctaLabel  String?
  ctaUrl    String?
  sortOrder Int
}

model WeeklyNote {
  id        String   @id @default(cuid())
  clientId  String
  client    Client   @relation(fields: [clientId], references: [id])
  weekOf    DateTime
  headline  String
  body      String
  videoUrl  String?
  published Boolean  @default(false)
  createdAt DateTime @default(now())
}

model SyncRun {
  id         String   @id @default(cuid())
  startedAt  DateTime @default(now())
  finishedAt DateTime?
  status     String   // SUCCESS | FAILED
  detail     String?  // error text or counts summary
}
```

---

## §6 — MODULE STATUS TRACKER (update every session)

| Module | What "done" means (acceptance criteria) | Status |
|---|---|---|
| **A — Scaffold & deploy skeleton** | Next.js app created; Prisma schema (§5) migrated to Railway Postgres; empty page deployed and loading at Railway URL | ✅ DONE — live at https://web-production-9aa91.up.railway.app (custom domain pending Module G) |
| **B — Auth & tenancy** | Clerk magic-link works; admin + client roles enforced; `getScopedContext()` is the only data-access path; **LEAK TEST PASSED**: logged in as Zoom user and Meridian user, verified zero data crossover in every section | ✅ DONE — 3 real Clerk sessions confirmed (ADMIN sees both clients; Zoom/Meridian test users each see only their own client). Full-section leak re-verification to repeat after Module D ships real UI. |
| **C — Smartlead sync** | `/api/cron/sync` guarded by CRON_SECRET; pulls analytics + lead-category counts for all active campaigns; upserts DailyStat with client-TZ bucketing; SyncRun rows written; Railway cron scheduled (hourly); manually verified one sync against Smartlead UI numbers | ☐ NOT STARTED |
| **D — Client dashboard UI** | All 7 sections ported from approved demo artifact with design system §9; renders from DB; empty states shown when data absent; responsive on a real phone | ☐ NOT STARTED |
| **E — Admin panel** | CRUD for clients, campaigns, pipeline (incl. qualified toggle + stage moves), milestones, onboarding steps, weekly notes (incl. publish toggle); invite-user action (Clerk invitation); no styling requirements | ☐ NOT STARTED |
| **F — Seed data** | Zoom Business Brokers seeded per §8; Meridian Demo Co. seeded with plausible fake week-6 data (reuse demo artifact numbers) | ☐ NOT STARTED |
| **G — Domain & production** | portal.woodsascension.com live via Hostinger CNAME; SSL green; Railway Postgres backups ON; env vars documented in repo `.env.example` | ☐ NOT STARTED |
| **H — Launch ritual** | Jim's user invited; Alan recorded welcome video; first weekly note published; 10-min live walkthrough call scheduled; recurring 15-min weekly portal-update block on Alan's calendar | ☐ NOT STARTED |

**Build order: A → B → C → D → E → F → G → H.** B's leak test gates everything after it. If time runs short on day one, the acceptable cut line is after D (dashboard visible with synced data; admin edits via Prisma Studio as stopgap).

---

## §7 — SMARTLEAD SYNC SPEC

- Env: `SMARTLEAD_API_KEY`. Reference the health-dashboard repo's Smartlead client code for endpoint patterns and auth query-param style — lift utilities directly where possible.
- Per active Campaign: fetch campaign analytics (sent, replies, bounces) and lead-category data sufficient to count positive replies per day. Positive = Smartlead categories: Interested / Meeting Request / (map exact category IDs during build; record mapping as a decision in §2).
- Aggregate across a client's campaigns into one DailyStat row per client per day.
- Bucketing: convert event timestamps to the client's IANA timezone before assigning a date.
- Idempotent upserts on `[clientId, date]` — safe to re-run any window.
- `apptsBooked` in DailyStat is maintained from PipelineEntry (count of entries reaching STAGE_2 that day) via a small rollup in the same cron.
- Rate limits: with hourly runs and ≤5 campaigns this is trivially under any Smartlead limit; add 250ms delay between calls anyway.
- Failure handling v1: SyncRun row with status FAILED + error text, visible in admin. No alerting (D5/§3).

---

## §8 — CLIENT SEED: ZOOM BUSINESS BROKERS (contract-derived)

- **Name:** Zoom Business Brokers · **Contact/user:** Jim Moazez (email: get from Alan at seed time) · **Timezone:** `America/Los_Angeles`
- **Stage labels:** Positive Reply → Appointment Booked → Appointment Held → Listing Signed
- **Pipeline:** empty at launch
- **Onboarding steps** (from contract; Day 0 = setup invoice paid):
  1. Setup invoice paid — Day 0 — DONE at seed
  2. Complete intake form — Days 0–3 — CTA: intake form link
  3. Attend onboarding call — Days 0–5 — CTA: calendar link
  4. Provide best-fit seed companies — Days 1–3
  5. Record pre-call videos — Days 1–7
  6. Approve messaging scripts (48-hour turnaround per agreement) — Days 4–10
  7. Domains & inboxes provisioned, warmup running — Days 1–21 (Alan's side, shown for transparency)
  8. Confirm calendar availability & integration — Days 7–14
  9. Campaign launch — ~Day 22
- **Milestone rail** (this is the contract visualized — the rail ends at the Day 111 review on purpose):
  1. Kickoff & setup — Day 0 — DONE
  2. Infrastructure live & warming — Day 1 — CURRENT at seed
  3. Messaging approved — ~Day 10 — NEXT
  4. Campaign launch — ~Day 22 — NEXT
  5. First qualified appointments — Days 35–45 — NEXT
  6. 10 qualified appointments — NEXT (targetValue 10)
  7. 25 qualified appointments — NEXT (targetValue 25)
  8. Day 111 review — proof of concept & ROI evaluation — NEXT
- **Qualified appointment criteria** (Section 5 — display in a small "What counts as qualified" expandable on the portal; also the admin checklist for the `qualified` toggle): decision-maker/owner · manufacturing or target trades (electrical, plumbing, HVAC, roofing, GCs) · $1M+ annual revenue · in target states, off avoid list · genuine exit intent, not curiosity · understands the call is about selling · seller not buyer · agreed and showed up.
- **KPI row pre-launch:** Domains live · Inboxes warming (~100 per contract) · Warmup sends · Days to launch. Post-launch: Emails sent · Positive replies · Qualified appointments · Pipeline value.

**Meridian Demo Co. seed:** copy the demo artifact's Week-6 dataset (18 days of stats, 4-stage pipeline with sample entries, milestones with 13/15 current, week-6 note). Timezone America/New_York. This login is Alan's permanent sales demo.

---

## §9 — DESIGN SYSTEM (from approved demo artifact — the artifact file is the visual spec; keep it in the repo at `/design/demo-artifact.jsx`)

- **Palette:** ink `#101E2E` · ink-soft `#3D4C5E` · muted `#77828F` · paper `#F3F3EE` · card `#FFFFFF` · line `#E4E3DA` · green `#1E6B4F` (money/positive/progress) · green-soft `#E7F1EB` · gold `#A87E3F` (milestones & booked calls ONLY) · gold-soft `#F5EDDE` · brick `#A9502F` (bounces, used sparingly)
- **Type:** Fraunces (display, headings, large numerics, italic accents) + Instrument Sans (UI/body). Tabular numerals on all data.
- **Feel:** private-bank statement. Porcelain background, generous whitespace, thin rules, pill badges, 14px card radius. Gold is scarce by design — it marks achievement.
- **Signature elements:** the milestone journey rail (green fill → gold current node with pulse ring) and gold diamond markers on chart days where appointments were booked.
- **Motion:** subtle rise-in on cards, count-up KPIs, pulsing current milestone. All behind `prefers-reduced-motion`.

---

## §10 — ENVIRONMENT & ACCOUNTS CHECKLIST

| Item | Value/Status |
|---|---|
| `DATABASE_URL` | Railway Postgres (new instance) |
| `SMARTLEAD_API_KEY` | Generate in Smartlead settings — **verify tonight** |
| `CLERK_SECRET_KEY` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Create Clerk app "WA Portal", enable email magic link, disable public signup |
| `CRON_SECRET` | Random 32-char string; Railway cron sends as header |
| Hostinger DNS | CNAME `portal` → Railway domain — **verify login tonight** |
| GitHub repo | `woods-ascension-portal` (private). New chat sessions receive a repo zip upload; if repo is made public, sessions may clone directly. |
| Clerk invitations | Jim's email needed before Module H |

---

## §11 — DEPLOYMENT

1. Railway: new project → Postgres plugin → Next.js service from GitHub repo → set env vars.
2. Railway cron: schedule hourly `GET https://<app>/api/cron/sync` with `Authorization: Bearer $CRON_SECRET` (or use a scheduled service hitting the route).
3. Hostinger: CNAME `portal` → Railway-provided domain; add custom domain in Railway; wait for SSL.
4. Enable Railway Postgres backups. Run one restore sanity check before Module H.

---

## §12 — CHANGE PROTOCOL (adaptability by design)

When reality contradicts the plan (an API doesn't behave as documented, a library fights the design, scope pressure appears):
1. **Classify:** (a) implementation detail — solve it, note nothing; (b) decision-level change — requires a new ADR row in §2 with rationale, and the old decision is struck through, never deleted; (c) scope change — goes to §14 v2 Backlog unless Alan explicitly moves it into §3.
2. **Never fork the truth:** the master doc is updated in the same session the change happens.
3. **Fallback ladders (pre-authorized, no discussion needed):**
   - Clerk magic link misbehaves → Clerk email OTP code → Clerk password (last resort).
   - Smartlead per-day analytics endpoint unavailable at needed granularity → pull cumulative totals per sync run and diff against previous run to derive daily figures (note as ADR).
   - Railway cron friction → Vercel-style external cron (cron-job.org) hitting the same guarded route.
   - Time runs out → cut line after Module D; admin edits via Prisma Studio until Module E ships.
4. **Scope pressure test:** any "while we're at it" idea must answer NO to "can Jim see the difference this week?" to justify inclusion. It can't. Backlog it.

---

## §13 — DAY-1 RUNBOOK (target: one day, hard max two)

**Tonight (30 min, before sleep):** Smartlead API key generated and saved · Hostinger login verified · Clerk account created · GitHub repo created · Railway project + Postgres created. *Access blockers are the #1 killer of one-day builds.*

| Block | Hours | Modules |
|---|---|---|
| Morning 1 | 1.5 | A — scaffold, schema, migrate, deploy skeleton |
| Morning 2 | 2.0 | B — Clerk, roles, tenancy helper, seed both clients (F partial), **leak test** |
| Midday | 2.0 | C — sync route, verify against Smartlead UI, schedule cron |
| Afternoon 1 | 3.0 | D — port dashboard UI section by section |
| Afternoon 2 | 1.5 | E — admin panel (time-boxed; Prisma Studio is the escape hatch) |
| Evening | 1.0 | G — DNS, SSL, backups · H prep — invite Jim, record Loom, publish note 1 |

If any block overruns by >50%, invoke the §12 cut line rather than extending the day.

---

## §14 — V2 BACKLOG (parked, not promised)

Webhooks for real-time freshness · sync failure alerts (Pushover) · client email digests ("your weekly results") · billing/invoice view aligned to contract fee schedule · Day-111 review report generator (auto-compiled metrics deck — high sales value for the Zoom pricing conversation) · multi-user clients · prospect-facing read-only demo link · white-label theming per client · portal usage analytics.

---

*End of Master Build Spec v1.0. Next session: upload this file + repo, and state which Module you're starting.*
