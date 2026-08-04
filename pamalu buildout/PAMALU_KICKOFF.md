# Pamalu portal — kickoff brief

Status: **interview stage, nothing built.** Read this first, then run the interview
in §4. Nothing below is decided; §2 and §3 are findings from the existing codebase,
not commitments.

Context to read alongside this: `MASTER_BUILD_SPEC.md` (§ADR log D1–D55 is the real
decision history), `prisma/schema.prisma`, and `canencia buildout/CANENCIA_PORTAL_HANDOFF.md`.

---

## 1. What we know so far

- Pamalu is expected to be a **LOCAL_SERVICES** client, the second one after Canencia Painting.
- Alan's description of this client (from the Canencia sessions): roofing, "my OG roofing
  client, biggest and longest term client", and the campaign is **"MUCH MUCH bigger than
  Canencia's"**. The day-to-day contacts are **Jes and Candice**. *(Confirm Pamalu is in fact
  this same client — it has not been said outright.)*
- The original Canencia handoff anticipated Pamalu once, on the `ClientLocation` model:
  `// Pamalu multi-GBP, day one`. So **multiple Google Business Profiles was expected from
  the start.**
- Alan has confirmed he **cannot promise automated outreach** to their customers — only
  reminders *to himself*. Anything the portal implies about chasing customers must stay
  true to that.
- As of the last session Alan had **not yet told them** a portal was coming.

## 2. What carries over from Canencia for free

The whole LOCAL_SERVICES surface already exists and is client-scoped, so a new client row
lights most of it up with no new code:

- Pages: Overview, Leads, Where You Rank, The Numbers, What I Need From You, Monthly Recap.
- Content registry + `<E>`/`<EList>` editable-copy system, so every client-facing string is
  Alan-editable per client rather than hardcoded.
- Metric resolver layer (`ls-metrics.ts`) with per-client manual overrides.
- Lead pipeline (8 stages), soft-delete/tombstone identity, notifications (email + Pushover),
  spam classification, review requests, follow-up dates.
- Integrations: CallRail, Gmail parsing (Google LSA + TalkRoute voicemail), Google Search
  Console, Google Places/reviews.

## 3. The structural gaps I can already see

**3a. Multi-location is only half-built — this is the big one.**
`ClientLocation` exists, but *only* `GeogridScan` carries a `locationId`. Every other
local-services model is client-scoped only:

| Model | Scoped by |
|---|---|
| `GeogridScan` | client **+ location** |
| `ServiceLead`, `CallRecord`, `SitePage`, `KeywordRank`, `LsaMonthlyStat`, `ReviewSnapshot`, `ReviewRequest`, `MonthlyWork`, `ClientTask` | client only |

So today the portal can show map rankings per location, but leads, reviews, ad spend and
rankings would all pool into one number. If Pamalu genuinely operates as several locations,
we need to decide *which* of those must split — and that decision drives schema migrations,
every resolver, and the page layouts. **Deciding this wrong is the most expensive mistake
available here**, which is why §4B leads with it.

**3b. Volume.** Canencia's board shows every lead as a card. That reads well at ~20
leads/month. At several hundred it stops being a board and needs list/table + filtering as
the primary view. The Leads page just gained search + source filtering (D55), which helps,
but the card-per-lead model itself may not survive real volume.

**3c. Roofing ≠ painting.** The 8 stages were written for a painter (`Quote Sent` →
`Job Scheduled` → `Job Won`). Roofing frequently runs an insurance/storm-restoration track
— adjuster meetings, claim approval, supplements — which is a genuinely different pipeline,
not a relabel. See §4D.

**3d. They may already have a CRM.** Roofers commonly run JobNimbus / AccuLynx / Roofr /
CompanyCam. If Pamalu does, then rebuilding a pipeline board here is duplicate data entry
they will abandon, and the portal should lean on reporting/visibility instead. See §4C.

---

## 4. Interview — questions to work through with Alan

### A. The business and who logs in
1. Confirm: is Pamalu Jes and Candice's roofing company? If not, who are they and what do they do?
2. What services do they actually sell, and which ones does Alan run marketing for?
3. Where do they operate — towns/regions?
4. Who will log in, by name and role? How many people?
5. How techy are they, honestly, compared with Bryan and Desiree? Phone-first or at a desk?
6. Does anyone need a *different* view (e.g. an office manager who works leads vs an owner who only wants the monthly picture)?

### B. Multi-location (answer before any building)
7. How many locations/Google Business Profiles do they have, and what are they?
8. Are these real separate offices, or one business with several service-area profiles?
9. Do Jes and Candice think of performance **per location**, or as one combined business?
10. Which of these must split by location, and which are fine combined: leads · phone calls · reviews · map rankings · website rankings · ad spend/cost-per-lead · the monthly recap?
11. Is there one website or several? One phone number or several?

### C. Where leads come from, and existing tools
12. What are all the ways a customer reaches them today? (Google LSA, Google Ads, Maps calls, website forms, referrals, door-knocking, storm canvassing…)
13. **Do they already use a CRM or job-management tool?** Which one? Who actually keeps it up to date?
14. If yes — is the portal meant to *replace* it, *report on top of it*, or stay entirely separate? (This single answer changes what we build more than any other.)
15. Do they use CallRail / a call-tracking or answering service already? Who answers the phone?
16. Is there anything Alan currently sends them by hand each month that the portal should absorb?

### D. Their sales process
17. Walk me through a job start to finish, from first contact to paid.
18. **Is any of this insurance/storm restoration?** Roughly what share vs straight retail?
19. If insurance is involved: what are the real steps (inspection → claim filed → adjuster meeting → approval → build → supplement → final)? Do those need to be visible stages?
20. Typical job value, and typical time from first contact to won?
21. Who owns follow-up — one person, or several?

### E. Scale
22. Roughly how many leads a month? And how many jobs?
23. Is it seasonal or storm-driven — do they get sudden spikes?
24. Monthly ad spend, roughly? (Drives whether cost-per-lead is a headline number or a footnote.)

### F. What Alan delivers, and what they ask him
25. What is Alan actually doing for them each month (SEO, Google Ads, LSA, content, GBP, reviews, site work)?
26. What do Jes and Candice ask him most often? What are they sceptical about?
27. What would make them say "this is genuinely useful" in week one?
28. Is there a number they judge success by that we are not currently tracking anywhere?

### G. Boundaries
29. Is there anything they must **never** see (Alan's costs, margins, internal notes, other clients)?
30. Anything Alan wants visible in admin/preview only, like the deferred Canencia tracking pages?
31. Do they get a monthly report today? What is in it, and what should change?

---

## 5. Suggested build order once answered

1. Settle multi-location (§B) → schema migration if needed, before any UI.
2. Create the client row + locations, invite a test login, confirm gating.
3. Seed real historical data so no page is ever demoed empty.
4. Wire integrations (call tracking, Gmail/LSA, GSC, reviews) per location.
5. Adjust pipeline stages for roofing/insurance if §D says so.
6. Re-do the copy pass for their voice — none of Canencia's painting-specific wording should survive.
7. Log the decisions as new ADR rows (continuing from D55).
