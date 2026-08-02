# IMPLEMENTATION_STATE.md — Canencia / LOCAL_SERVICES build
**Written 2026-08-02 by the planning session (strong model). Read this FIRST, before any other file.**

## 0. How to use this file

You are implementing a build that has already been fully planned and approved. Do not re-plan, do not redesign, do not reopen decisions. Reading order:

1. This file, in full.
2. `canencia buildout/CANENCIA_PORTAL_HANDOFF.md` — the build spec. All its decisions are final.
3. `MASTER_BUILD_SPEC.md` — §5 (schema mirror), §12 (change protocol), D5, D8.
4. `canencia buildout/canencia_portal_v8.html` — the approved visual/behavioral spec for every client-facing page. Port it; do not redesign it.
5. `AGENTS.md` warning: this Next.js (16.2.10) has breaking changes vs. training data. Middleware lives in `src/proxy.ts` (not middleware.ts). `searchParams`/`params`/`cookies()` are async (already the codebase pattern). Check `node_modules/next/dist/docs/` when unsure.

**Communicating with Alan:** plain, simple English only — no jargon, explain like he's non-technical without losing the point. At the end of EVERY message, restate anything you need from him clearly and simply, with the implication of each choice. This is a standing rule he set explicitly.

**Ground rules from the handoff (repeated because they are absolute):**
- Work on branch `local-services`. Take a full Postgres dump (`pg_dump`) before ANY migration.
- Nothing changes for COLD_EMAIL clients. Every new behavior gates on `Client.type`.
- No autosave in admin edit mode (client task submissions DO autosave — different system, intentional).
- No hardcoded client-facing strings on local-services pages — registry only.
- Don't reuse `ActivityChart`, `Campaign`, or `DailyStat` for local-services — build siblings.
- Job value is asked ONLY on drop into JOB_WON. Spam is logged, never deleted.
- No self-serve OAuth UI. No Google Ads API for LSA (manual monthly entry). No Twilio/SMS (stub the channel type only).

## 1. Decisions made in the planning session (approved by Alan)

These resolve every collision found in the deep review. They are settled — implement as written.

| # | Decision |
|---|---|
| D-A | **Overview forks, not guards.** `/` is shared by both client types. `src/app/(dashboard)/page.tsx` becomes a thin fork on `client.type`: extract the current body verbatim into `ColdEmailOverview`, add `LsOverview`. Zero cold-email behavior change. |
| D-B | **New route paths (Alan-confirmed 2026-08-02):** `/nextsteps` (What I Need From You), `/leads`, `/rank` (Where You Rank), `/numbers` (The Numbers), `/recap` (Monthly Recap), shared `/documents` (existing page, reused as-is). Note the mock's "Numbers" section id is `metrics` — do NOT use `/metrics`, that's the cold-email page. Content-registry keys keep the handoff's `ask.` prefix (internal names only, never shown as URLs). |
| D-C | **Guards both directions:** every new page starts with a `requireClientType("LOCAL_SERVICES")` helper (redirects home if wrong type); each existing cold-email page (`/metrics`, `/appointments`, `/roadmap`, `/infrastructure`, `/changelog`) gets a one-line `requireClientType("COLD_EMAIL")`. Helper must honor admin preview mode (same resolution as `getDashboardScope`). |
| D-D | **`src/proxy.ts`:** change the public-route entry `"/api/cron/sync"` to `"/api/cron/(.*)"` — otherwise Clerk blocks the new cron routes and Railway cron fails silently. `CRON_SECRET` bearer check inside each route remains the real gate. |
| D-E | **`SyncRun.source String @default("SMARTLEAD")`.** Every cron route (including the existing Smartlead one) scopes BOTH its self-heal (`updateMany where status RUNNING + older than 10 min`) AND its own rows by its source value (`SMARTLEAD`, `CALLRAIL`, `GMAIL`, `GSC`, `PLACES`). Without this, the 5-min Gmail route would mark a long CallRail run as FAILED. |
| D-F | **Existing Smartlead sync:** add `type: "COLD_EMAIL"` to its client query (explicitness; it already skips campaign-less clients). This + D-E are the ONLY changes to the existing sync route. |
| D-G | **MetricKey enum→String is Migration A**, done first, in isolation, with hand-written SQL (Prisma's auto-generated migration would drop/re-add the column and lose data). See §2. |
| D-H | **Prisma 6 `Bytes` = `Uint8Array`**, not Buffer. The crypto helper must `Buffer.from(u8)` on read. |
| D-I | ~~New deps to install when a phase first needs them: `zod`, `googleapis`, `@anthropic-ai/sdk`, ...~~ → **Spam classifier uses DeepSeek, not Claude** (Alan's explicit request, 2026-08-02, mid-Phase-3) — `@anthropic-ai/sdk` was installed then removed; `src/lib/spam-classify.ts` calls DeepSeek's OpenAI-compatible API via plain `fetch` instead, model `deepseek-chat`. Full dep list as actually used: `zod`, `googleapis`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (Phase 5). Pushover = plain `fetch`, no lib. Env vars actually used (see `.env.example`): `ENCRYPTION_KEY`, `DEEPSEEK_API_KEY`, `PUSHOVER_APP_TOKEN` (fallback default — real channels carry their own `token`, see MASTER_BUILD_SPEC.md D27), `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` (Phase 5). |
| D-J | **Two CLIENT users on one client (Bryan + Desiree) is approved.** Log an ADR row in MASTER_BUILD_SPEC §2 superseding D4's one-user rule and striking "multi-user clients" from §3's OUT list. Schema already supports it. |
| D-K | **Gmail routing:** refresh token lives in Canencia's `ClientIntegration` (provider GMAIL) row. Matcher parameters live in that row's `config` Json: form from-address (`noreply@oahuhousepainters.com`), site domain, LSA markers, cursor. Sync loops per-client GMAIL integrations; each client's matchers only claim their own messages. |
| D-L | **Idempotency additions to the handoff sketch (approved):** `FormSubmission.gmailMessageId String @unique`, `ServiceLead.gmailMessageId String? @unique`, `CallRecord.needsReview Boolean` (the <20s flag), `ReviewItem @@unique([clientId, author, reviewedAt])` (Places has no stable review id). |
| D-M | **`MetricOverride` is `@@unique([clientId, scopeKey])`** — one override per number; reset = delete the row. No `active` flag, no history. |
| D-N | **`jobValue` = whole dollars** (matches `PipelineEntry.dealValue`). Cents only for `spendCents`. |
| D-O | **Interpolated data strings are resolvers, not registry copy.** The mock put `.metric-support` lines ("May 202 · June 336 · July 293") in the copy tier; the handoff says every number is a resolver. Handoff wins: number-bearing support lines are composite resolver outputs (e.g. `lsa.impressions.trend`); pure explanation lines are registry copy. |
| D-P | **Geogrid `gridJson` = `{ rows, cols, cells: number[] }`**, normalized at upload. Renderer draws any square grid; don't assume 7×7. Rank-band coloring ports from the mock's `rankClass()`. |
| D-Q | **Timezone:** all month strings ("2026-07"), date pills, and "this month" buckets computed in `client.timezone` (Canencia = `Pacific/Honolulu`; HST has no DST, form emails stamp `HST` = UTC-10). Use `src/lib/timezone.ts` helpers. `GscDailyStat.date` = UTC-midnight date-only like `DailyStat`. |
| D-R | **R2 `fileUrl` stores the object KEY**; public base URL comes from env. Export resolves keys → full URLs. |
| D-S | **String-not-enum for growable sets** (provider, classification, statuses, channel, notification kind) with TS const unions. Enums only for closed-forever sets: `ClientType`, `LeadSource`, `LeadStage`. |
| D-T | **Enum values / vocab:** CallRecord.classification `QUALIFIED\|ROBOCALL\|SPAM\|WRONG_AREA\|UNKNOWN`; ReviewRequest.status `QUEUED\|SENT\|REMINDED\|REVIEWED\|DEAD`; ClientTask.status `OPEN\|DONE`; responseType `CHECK\|TEXT\|PHOTO\|BOTH`; Notification.kind `NEW_LEAD\|TASK_SUBMISSION\|WATCHDOG\|SYNC_FAILURE\|REVIEW_REQUEST`; NotificationChannel.channel `PUSHOVER\|EMAIL\|SMS`. |

## 2. Approved schema plan — Phase 1

### Migration A — `metrickey_enum_to_string` (FIRST, isolated)

Schema: delete `enum MetricKey`; `MetricConfig.metricKey` and `TemplateMetricConfig.metricKey` become `String`. Both `@@unique`s unchanged.

Migration SQL (hand-author it — replace whatever `prisma migrate dev --create-only` drafts):
```sql
ALTER TABLE "MetricConfig" ALTER COLUMN "metricKey" TYPE TEXT USING "metricKey"::text;
ALTER TABLE "TemplateMetricConfig" ALTER COLUMN "metricKey" TYPE TEXT USING "metricKey"::text;
DROP TYPE "MetricKey";
```

Code updates in the SAME commit (complete, verified-by-grep list — nothing else imports MetricKey):
1. `src/app/(dashboard)/metrics/page.tsx` — drop `import type { MetricKey }`; add local `const COLD_EMAIL_METRIC_KEYS = ["EMAILS_SENT","POSITIVE_REPLIES","QUALIFIED_APPTS","POSITIVE_REPLY_RATE","EMAILS_PER_BOOKED","EMAILS_PER_QUALIFIED"] as const; type MetricKey = (typeof COLD_EMAIL_METRIC_KEYS)[number];` — all existing `Record<MetricKey,…>` types then compile unchanged.
2. `src/app/admin/clients/[id]/actions.ts` — `upsertMetricConfig(..., metricKey: string, ...)`; remove MetricKey from the type import.
3. `src/app/admin/templates/actions.ts` — same for `upsertTemplateMetric`.
4. `src/app/admin/templates/[id]/page.tsx` — drop the type import and the two `key as MetricKey` casts.

Untouched (verified): `dashboard-compute.ts`, `seed.ts`, `applyTemplate`, `admin/clients/[id]/page.tsx`.

Verify: `tsc --noEmit` clean; `/metrics` renders identically for a cold-email client; a metric-config save round-trips in admin.

### Migration B — `client_type_and_local_services` (schema only, no code)

- `Client` gets `type ClientType @default(COLD_EMAIL)` + relation fields for all new models.
- `SyncRun` gets `source String @default("SMARTLEAD")`.
- New enums: `ClientType { COLD_EMAIL LOCAL_SERVICES }`, `LeadSource { LSA GBP_CALL WEBSITE_FORM REFERRAL OTHER }`, `LeadStage { NEW CONTACTED QUOTE_SENT JOB_SCHEDULED JOB_WON REVIEW_REQUESTED REVIEW_COMPLETE LOST }`.
- New models, exactly as approved (conventions: `id String @id @default(cuid())`, explicit client relations, indexes as listed):

```prisma
model ClientIntegration {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  provider String            // CALLRAIL | GMAIL | GSC | GOOGLE_PLACES
  config Json
  credentials Bytes          // AES-256-GCM sealed with ENCRYPTION_KEY; Uint8Array in Prisma 6
  status String @default("ACTIVE")   // ACTIVE | ERROR | DISABLED
  lastSyncAt DateTime?
  lastError String?
  createdAt DateTime @default(now())
  @@unique([clientId, provider])
}

model ServiceLead {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  source LeadSource
  stage LeadStage @default(NEW)
  name String?               // null = LSA "Potential Customer"
  phone String?
  email String?
  location String?           // city
  address String?            // full project address (form leads)
  serviceType String?
  message String?
  qualified Boolean?         // null = unreviewed
  needsDetails Boolean @default(false)
  jobValue Int?              // whole dollars; set only at JOB_WON (UI-enforced)
  callRecordId String? @unique
  callRecord CallRecord? @relation(fields: [callRecordId], references: [id], onDelete: SetNull)
  formSubmissionId String? @unique
  formSubmission FormSubmission? @relation(fields: [formSubmissionId], references: [id], onDelete: SetNull)
  gmailMessageId String? @unique
  callRailUrl String?
  recordingUrl String?
  nextActionLabel String?
  nextActionAt DateTime?
  receivedAt DateTime
  stageChangedAt DateTime @default(now())
  createdAt DateTime @default(now())
  notes LeadNote[]
  activity LeadActivity[]
  reviewRequests ReviewRequest[]
  @@index([clientId, stage])
  @@index([clientId, receivedAt])
}

model LeadNote {
  id String @id @default(cuid())
  leadId String
  lead ServiceLead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  authorUserId String
  body String
  createdAt DateTime @default(now())
}

model LeadActivity {
  id String @id @default(cuid())
  leadId String
  lead ServiceLead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  type String                // STAGE_MOVE | NOTE | QUALIFIED_TOGGLE | VALUE_SET | TOUCH
  meta Json?
  createdAt DateTime @default(now())
  @@index([leadId, createdAt])
}

model CallRecord {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  callRailId String @unique
  occurredAt DateTime
  durationSec Int
  callerNumber String
  trackingNumber String
  keypress String?
  classification String      // QUALIFIED | ROBOCALL | SPAM | WRONG_AREA | UNKNOWN
  needsReview Boolean @default(false)   // duration < 20s — flagged, never auto-deleted
  forwarded Boolean
  recordingUrl String?
  raw Json
  lead ServiceLead?
  @@index([clientId, occurredAt])
}

model FormSubmission {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  gmailMessageId String @unique
  receivedAt DateTime
  name String?
  phone String?
  email String?
  address String?
  message String?
  spamVerdict Boolean?       // null = low-confidence, awaiting Alan review
  spamConfidence Float?
  spamReason String?
  passedOn Boolean @default(false)
  raw Json                   // parsed body + parse errors if any
  lead ServiceLead?
  @@index([clientId, receivedAt])
}

model LsaMonthlyStat {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  month String               // "2026-07", client-TZ month
  impressions Int
  topRatePct Float
  absTopRatePct Float
  spendCents Int
  chargedLeads Int
  updatedAt DateTime @updatedAt
  @@unique([clientId, month])
}

model GscDailyStat {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  date DateTime              // UTC-midnight date-only, same as DailyStat
  clicks Int
  impressions Int
  @@unique([clientId, date])
}

model SitePage {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  url String
  town String
  publishedAt DateTime
  indexed Boolean @default(false)
  indexedAt DateTime?
  lastCheckedAt DateTime?
  @@unique([clientId, url])
}

model ClientLocation {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  name String
  isPrimary Boolean @default(false)
  geogridScans GeogridScan[]
}

model GeogridScan {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  locationId String
  location ClientLocation @relation(fields: [locationId], references: [id])
  keyword String
  month String
  gridJson Json              // { rows, cols, cells: number[] } — normalized at upload
  avgRank Float              // computed server-side on upload
  top3Pct Float
  takenAt DateTime
  @@unique([clientId, locationId, keyword, month])
}

model KeywordRank {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  month String
  keyword String
  volume Int?
  position Int
  prevPosition Int?
  url String
  @@unique([clientId, month, keyword])
}

model ReviewSnapshot {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  date DateTime
  count Int
  rating Float
  @@unique([clientId, date])
}

model ReviewItem {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  author String
  rating Int
  text String
  reviewedAt DateTime
  @@unique([clientId, author, reviewedAt])
}

model ReviewRequest {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  leadId String?
  lead ServiceLead? @relation(fields: [leadId], references: [id], onDelete: SetNull)
  customerName String
  phone String
  jobFinishedAt DateTime
  status String @default("QUEUED")   // QUEUED | SENT | REMINDED | REVIEWED | DEAD
  sentAt DateTime?
  remindAt DateTime?
  createdAt DateTime @default(now())
}

model ClientTask {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  title String
  explanation String
  urgency String
  responseType String        // CHECK | TEXT | PHOTO | BOTH
  status String @default("OPEN")     // OPEN | DONE
  sortOrder Int
  completedAt DateTime?
  submissions TaskSubmission[]
}

model TaskSubmission {
  id String @id @default(cuid())
  taskId String
  task ClientTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  kind String                // TEXT | PHOTO
  textValue String?
  fileUrl String?            // R2 object KEY, not full URL
  submittedByUserId String
  createdAt DateTime @default(now())
  notifiedAt DateTime?       // debounce for "first meaningful save" Pushover
}

model WorkLog {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  body String
  source String @default("ADMIN_NOTE")   // ADMIN_NOTE | SYSTEM
  createdAt DateTime @default(now())
}

model MonthlyWork {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  month String
  heroTitleAuto String?
  heroSubAuto String?
  heroTitleManual String?    // manual wins when set
  heroSubManual String?
  items Json                 // [{ title, detail, recap }]
  noteFromAlan String?
  nextMonth Json             // string[]
  @@unique([clientId, month])
}

model PortalContent {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  key String
  value String
  updatedAt DateTime @updatedAt
  @@unique([clientId, key])
}

model MetricOverride {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  scopeKey String            // e.g. "lsa.cpl:2026-07"
  value String
  originalValue String       // liveDisplay captured at confirm time
  createdAt DateTime @default(now())
  @@unique([clientId, scopeKey])
}

model NotificationChannel {
  id String @id @default(cuid())
  clientId String?
  client Client? @relation(fields: [clientId], references: [id])
  userId String?
  channel String             // PUSHOVER | EMAIL | SMS (SMS = stub only)
  address String
  active Boolean @default(true)
}

model Notification {
  id String @id @default(cuid())
  clientId String
  client Client @relation(fields: [clientId], references: [id])
  kind String                // NEW_LEAD | TASK_SUBMISSION | WATCHDOG | SYNC_FAILURE | REVIEW_REQUEST
  payload Json
  createdAt DateTime @default(now())
  deliveredAt DateTime?
  error String?
  @@index([clientId, kind, createdAt])
}
```

### Sequence for Phase 1 (in order)

1. `git checkout -b local-services`; `pg_dump` the Railway database to a dated file.
2. Migration A + its 4 code edits, one commit. Verify (§2A checks).
3. Migration B, one commit. Verify: `tsc` clean, app boots, cold-email pages identical.
4. Update MASTER_BUILD_SPEC: §5 schema mirror; ADR rows for (a) MetricKey→String, (b) ClientType + local-services models + D4 supersession (multi-user client, per D-J).
5. Nav/route gating: `NAV_ITEMS` in `Sidebar.tsx` becomes per-ClientType config (LOCAL_SERVICES order: Overview · What I Need From You (open-count badge) · Leads · Where You Rank · The Numbers · Monthly Recap · Documents). `(dashboard)/layout.tsx` fetches `client.type` and passes nav config. `requireClientType` helper + guards per D-C. Overview fork per D-A. `proxy.ts` per D-D. Empty-shell placeholder pages at `/nextsteps`, `/leads`, `/rank`, `/numbers`, `/recap`.
6. Canencia client row (type LOCAL_SERVICES, timezone `Pacific/Honolulu`) + primary `ClientLocation`. Clerk invites: Desiree `canencia.painting15@gmail.com`; Bryan `bryancan10@yahoo.com`.
7. **Done when:** migrations clean; cold-email clients pixel-identical; Canencia login shows an empty local-services shell.

## 3. Approved architecture skeletons (fill in, don't redesign)

### 3a. Content registry + `<Editable>` + diff-save (Phase 2)

Files:
```
src/content/local-services.ts        registry: every client-facing string, key → { def, kind?, max? }
src/lib/content.ts                   getContent(clientId) — override ?? default, wrapped in React cache()
src/lib/content-actions.ts           publishPortalChanges / resetOverride server actions
src/components/ls/EditProvider.tsx   client context: edit mode, dirty map, edit bar, diff modal, unlock modal
src/components/ls/Editable.tsx       <E> and <EList> — the ONLY way registry copy renders
src/components/ls/Num.tsx            data-tier renderer (see 3c)
```

Key shapes:
```ts
// registry
type Entry = { def: string; max?: number } | { kind: "list"; def: string[]; maxItem?: number };
export const LS_CONTENT = { "overview.hero.eyebrow": { def: "July 2026" }, /* every string from the v8 mock */ } as const satisfies Record<string, Entry>;
export type ContentKey = keyof typeof LS_CONTENT;

// resolution
export const getContent = cache(async (clientId: string) => {
  const rows = await prisma.portalContent.findMany({ where: { clientId } });
  const byKey = new Map(rows.map(r => [r.key, r.value]));
  return {
    text: (k: ContentKey) => byKey.get(k) ?? (LS_CONTENT[k] as any).def,
    list: (k: ContentKey) => byKey.has(k) ? JSON.parse(byKey.get(k)!) : (LS_CONTENT[k] as any).def,
  };
});

// publish — admin ROLE required (preview cookie alone is not enough)
// zod: key ∈ registry keys, value plain text, per-key length caps; list values re-validated item-wise
// prisma.$transaction([ ...PortalContent upserts, ...MetricOverride upserts ]); revalidatePath("/", "layout")
```

Coverage enforcement (all three): (1) `<E k>` accepts only `ContentKey` — unregistered key = compile error; (2) ESLint `react/jsx-no-literals` scoped to local-services page/component dirs — raw JSX text fails lint; (3) pages call `c.text(k)` and pass `(k, value)` into `<E>` — never inline copy.

Hardest lines, settled:
- `<E>` renders plain `<Tag>{v}</Tag>` outside edit mode; in edit mode `contentEditable + suppressContentEditableWarning`, `onInput` → `markDirty(k, orig, el.innerText)` (innerText, not textContent), paste handled via `clipboardData.getData("text/plain")` + Selection API (NOT deprecated execCommand), Enter blurs for non-paragraph tags.
- `markDirty`: normalized(now) === normalized(orig) → remove from dirty map; else set `{from, to}`.
- `<EList>`: items render as editable cells keyed `${k}#${i}` internally; add/remove buttons appear in edit mode; on save the provider reassembles ONE change per list key with a JSON-array value.
- Thesis paragraphs with bold spans: registry defaults may contain `**…**`; render splits on that for display emphasis; edited values are plain text and lose emphasis (accepted — plain-text-only is the validation rule).
- Save → diff modal (group dirty entries by key prefix before the first "."; flag data-tier overrides separately, port the mock's warn box) → single server action → `router.refresh()`. Discard → restore `from` into DOM nodes, clear map. NO autosave.

### 3b. Gmail ingestion pipeline (Phase 3)

Files:
```
src/lib/crypto.ts                 sealJson/openJson — AES-256-GCM, iv|tag|ciphertext in one Bytes blob; Buffer.from() on Uint8Array reads
src/lib/google-oauth.ts           refresh-token → access token (shared with GSC); admin-only consent-completion route
src/lib/gmail.ts                  listNewMessages(cursor), getMessage(id) — fetch-wrapper conventions of src/lib/smartlead.ts
src/lib/gmail-parsers.ts          two matchers/parsers as PURE functions (unit-test on fixture emails first)
src/lib/notify.ts                 notify(clientId, kind, payload): NotificationChannel fan-out → Pushover POST → Notification row (deliveredAt/error)
src/app/api/cron/sync-gmail/route.ts
```

Cursor: `config.cursor = { historyId?: string; lastInternalDate: number }`. Primary: `history.list(startHistoryId)`. On 404 (expired history): fall back to `messages.list(q: "after:<lastInternalDate/1000 - 3600>")` — one-hour overlap; `gmailMessageId @unique` upserts make overlap harmless. Advance cursor ONLY after the batch commits.

Parser interfaces:
```ts
type GmailMeta = { id: string; internalDate: number; from: string; subject: string };
type ParseOutcome<T> = { ok: true; data: T } | { ok: false; reason: string };
interface Matcher<T> {
  provider: "LSA" | "ESTIMATE_FORM";
  matches(meta: GmailMeta, cfg: GmailMatcherConfig): boolean;
  parse(body: { text: string; html?: string }, meta: GmailMeta): ParseOutcome<T>;
}
```
- LSA: subject `/Potential Customer.?s sent you a new request/i`; name literal "Potential Customer" → `null`; parse location(city)/serviceType/message; → `ServiceLead { source: LSA, needsDetails: true }` + Pushover to client AND Alan.
- Form: from = cfg form address; subject `New estimate request - {Name} ({City})`; labeled-field extraction — order-independent regex per label, stop at next known label, tolerate `M[AE]SSAGE`; address = street line + `/^(.+),\s*([A-Z]{2}),?\s*(\d{5})/m` (city = capture 1); `Submitted: {datetime} HST` parsed as fixed UTC-10. → spam classify (§3.3 of handoff: haiku-class model, strict JSON `{qualified, confidence, reason}`; confidence < 0.75 → `spamVerdict: null` for Alan's review) → `FormSubmission` → if real, `ServiceLead { source: WEBSITE_FORM }` + Pushover.
- Poison-message policy: parse failure NEVER blocks the cursor and NEVER loses the email — store a `FormSubmission` with nulls + `raw: { rawBody, parseError }`, list failures in `SyncRun.detail`, one Pushover to Alan per run. Transient API error mid-batch → throw → SyncRun FAILED, cursor NOT advanced → next 5-min run retries.
- Watchdog: end of every run, per client: `max(FormSubmission.receivedAt)` older than 7 days AND no WATCHDOG Notification row in last 24h (query the Notification table) → Pushover Alan.
- Route shell: copy `/api/cron/sync` exactly — CRON_SECRET bearer guard, `SyncRun { source: "GMAIL" }`, self-heal scoped `source: "GMAIL"`, loop `client.findMany({ where: { status: "ACTIVE", type: "LOCAL_SERVICES", integrations: { some: { provider: "GMAIL", status: "ACTIVE" } } } })`.

Same shell pattern for `/api/cron/sync-callrail` (source CALLRAIL, */15min), `/api/cron/sync-gsc` (GSC, daily), `/api/cron/sync-places` (PLACES, daily). CallRail classification rules are handoff §3.1 verbatim (keypress → QUALIFIED; no keypress on IVR line → ROBOCALL; LSA line bypasses IVR → QUALIFIED; <20s → `needsReview: true`, never auto-delete). Recordings play in-portal via a proxy route fetching from CallRail with the API key.

### 3c. Data-resolver + MetricOverride layer (Phase 2, proven on Overview)

Files:
```
src/lib/ls-metrics.ts        scopeKey grammar, RESOLVERS registry, resolveMetrics() batch
src/components/ls/Num.tsx    the ONLY way a number renders on local-services pages
src/lib/metric-actions.ts    setOverride / resetOverride server actions
```

scopeKey grammar: `domain.metric[:period]`, period = client-TZ month `"2026-07"` or absent (= current/live). Examples: `lsa.cpl:2026-07`, `lsa.impressions.trend`, `leads.real:2026-07`, `leads.split:2026-07`, `reviews.count`, `gsc.clicks:28d`, `geo.avgRank:2026-08`, `pipeline.wonValue:2026-07`.

```ts
export type ResolvedMetric = {
  scopeKey: string;
  display: string;            // renders: "$22", "34", "May 202 · June 336 · July 293"
  liveDisplay: string;        // ALWAYS computed, even when overridden — powers the badge + originalValue
  overridden: boolean;
  source: string;             // "Google Ads (manual entry)" | "CallRail" | "Local Falcon" | "Leads board" …
  asOf: Date | null;          // integration.lastSyncAt or manual-entry updatedAt
};
type Resolver = (ctx: { clientId: string; tz: string }, period: string | null)
  => Promise<{ raw: number | string; display: string; source: string; asOf: Date | null }>;
```
`resolveMetrics(clientId, keys[])`: ONE `metricOverride.findMany` for all keys; for each key split into `(prefix, period)`, run `RESOLVERS[prefix]` (always — never short-circuit on override), merge: `display = override?.value ?? live.display`.

Rules settled:
- `display` is a string end-to-end (an override can hold "11 of 18" as easily as "34").
- Pages (server components) declare their key list, call resolveMetrics once, pass `ResolvedMetric` into `<Num>` (client component).
- `<Num>` outside edit mode: renders display; for admins, if overridden show "overridden — live value is {liveDisplay}" badge + one-click reset. In edit mode: locked (🔒); click → unlock modal (field label, liveDisplay, asOf, explicit checkbox) → edits accumulate in EditProvider's override map → same diff-review + publish transaction as copy (`originalValue = liveDisplay` at confirm).
- Reset = delete the MetricOverride row + revalidatePath; next render falls through to the resolver.
- Zero-data renders "—" gracefully; the August-only month strip must look intentional with one cell (handoff §3.6).
- Number-bearing support lines are composite resolvers, not registry copy (D-O).

## 4. Phase order (handoff §7 — each phase ends reviewable and shippable)

1. **Phase 1** — Schema + gating (this file §2 sequence). *Done when: cold-email unchanged; Canencia login shows empty local-services shell.*
2. **Phase 2** — Content system + edit mode + resolver layer, proven on Overview (§3a + §3c). *Done when: every visible Overview string editable incl. all thesis paragraphs; copy edit + data override survive reload; discard works; nothing autosaves.*
3. **Phase 3** — Leads vertical: CallRail + Gmail + spam + Pushover + kanban (§3b). *Done when: real call, real form submit, real LSA email each land correctly and ping both phones; robocalls/spam logged + invisible to client; watchdog fires on a simulated silent week.*
4. **Phase 4** — Rankings + Numbers + manual admin entry (LSA stats / geogrid / Ahrefs / SitePage forms). *Done when: August geogrid upload renders computed averages in a one-month strip; Numbers shows July: 293 impressions, $22.11, 1 charged lead.*
5. **Phase 5** — What I Need From You (tasks/submissions/R2) + Monthly Recap (WorkLog, builder, MonthlyWork single-source, AI hero with manual override).
6. **Phase 6** — Export/Import + July backfill (CallRail + GSC automatic; LSA May–July manual: 202/336/293 impressions, $0/$39.32/$22.11, 0/2/1 charged leads) + watchdog armed + copy pass + mobile pass (Bryan is phone-first).

## 5. Where to begin

**Start at §2 Sequence step 1**: create branch `local-services`, take the pg_dump, then Migration A. Present each migration diff to Alan before running it (plain English, per the communication rule). Do not start Phase 2 until Phase 1's done-when holds.

Outstanding items to collect from Alan (not blockers for starting):
- Pushover app token + user keys (Phase 3), Google Cloud OAuth credentials (Phase 3/4), CallRail API key (Phase 3), R2 bucket credentials (Phase 5). Ask for each at the START of its phase, plainly, one at a time.

## 6. Noted for later (Alan, 2026-08-02 — do not build yet, raise again once Phases 1-6 are mostly done)

Two admin-only tracking pages, requested while Phase 2 was in progress:

1. **Full Ahrefs + GSC CSV import, admin-only, perpetually tracked.** Alan wants to upload the complete raw CSV exports (not just what's client-visible on Where You Rank / The Numbers) so HE can see month-over-month movement across every client and judge what's working. This is bigger than the `KeywordRank`/`GscDailyStat` tables already in the schema (Phase 1) — those hold only what renders to the client; this new page/table is for Alan's own cross-client analysis and should keep the full CSV data, not a client-visible subset.
2. **A fully admin-only Changelog page** for LOCAL_SERVICES clients (separate concept from the existing `ChangelogEntry` model, which is COLD_EMAIL's client-VISIBLE changelog).

**Visibility rule for both, stated explicitly by Alan:** visible when he's ADMIN in "preview as client" mode (so he's reminded they exist while doing his normal workflow, which is mostly through preview) — but NEVER visible to the actual client's own login. This is a new visibility tier: today `isPreview` only distinguishes "banner and edit controls show" — these two pages need a third state (admin/preview-only, hidden from real CLIENT-role sessions entirely, not just guarded like everything else). Route guards for these will need to check `ctx.role === "ADMIN"` specifically, not just resolve scope.

Revisit once Phases 1-6 are mostly done, per Alan's explicit instruction not to build this now.
