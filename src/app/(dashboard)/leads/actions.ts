"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDashboardWriteScope } from "@/lib/dashboard-scope";
import { getScopedContext } from "@/lib/auth";
import { notify } from "@/lib/notify";
import type { LeadStage } from "@prisma/client";

// Same tenancy guarantee as the rest of the client-writable actions
// (dashboard)/actions.ts uses for COLD_EMAIL: a CLIENT can only touch
// their own leads, an ADMIN in preview mode can exercise the same actions
// against the previewed client — never trust a leadId alone.
async function assertOwnsLead(leadId: string, clientId: string) {
  const lead = await prisma.serviceLead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.clientId !== clientId) throw new Error("Forbidden");
  return lead;
}

// Every stage move except into JOB_WON — that one requires a value (see
// setJobWon) and is the ONLY place job value is ever asked, per the
// handoff's do-not list.
export async function moveLeadStage(leadId: string, newStage: LeadStage) {
  const scope = await requireDashboardWriteScope();
  const lead = await assertOwnsLead(leadId, scope.clientId);
  if (newStage === "JOB_WON") {
    throw new Error("Use setJobWon to move a lead into Job Won — a value is required");
  }
  await prisma.$transaction([
    prisma.serviceLead.update({ where: { id: leadId }, data: { stage: newStage, stageChangedAt: new Date() } }),
    prisma.leadActivity.create({ data: { leadId, type: "STAGE_MOVE", meta: { from: lead.stage, to: newStage } } }),
  ]);
  revalidatePath("/leads");
}

export async function setJobWon(leadId: string, jobValueDollars: number) {
  const scope = await requireDashboardWriteScope();
  const lead = await assertOwnsLead(leadId, scope.clientId);
  if (!Number.isFinite(jobValueDollars) || jobValueDollars < 0) {
    throw new Error("Enter a valid job value");
  }
  const value = Math.round(jobValueDollars);
  await prisma.$transaction([
    prisma.serviceLead.update({
      where: { id: leadId },
      data: { stage: "JOB_WON", stageChangedAt: new Date(), jobValue: value },
    }),
    prisma.leadActivity.create({
      data: { leadId, type: "VALUE_SET", meta: { from: lead.stage, to: "JOB_WON", jobValue: value } },
    }),
  ]);
  revalidatePath("/leads");
}

export async function addLeadNote(leadId: string, body: string) {
  const scope = await requireDashboardWriteScope();
  const ctx = await getScopedContext();
  await assertOwnsLead(leadId, scope.clientId);
  const trimmed = body.trim();
  if (!trimmed) return;
  await prisma.$transaction([
    prisma.leadNote.create({ data: { leadId, authorUserId: ctx.userId, body: trimmed } }),
    prisma.leadActivity.create({ data: { leadId, type: "NOTE" } }),
  ]);
  revalidatePath("/leads");
  revalidatePath("/"); // the Overview shows each lead's note count
}

// Every lead is worthwhile until someone says otherwise — robocalls and spam
// forms are filtered out long before they could become a lead, so the thing
// worth recording is the exception. qualified === false means bad fit;
// null and true both mean it counted. See D34.
// Renaming happens on the Overview far more than on the Leads board: the
// commonest first act on a fresh lead is putting a name to a phone number.
// Blank clears back to null so the card falls back to showing the number
// rather than displaying an empty title.
export async function renameLead(leadId: string, name: string) {
  const scope = await requireDashboardWriteScope();
  const lead = await assertOwnsLead(leadId, scope.clientId);
  const trimmed = name.trim().slice(0, 120);
  const next = trimmed.length > 0 ? trimmed : null;
  if (next === lead.name) return;

  await prisma.$transaction([
    prisma.serviceLead.update({ where: { id: leadId }, data: { name: next } }),
    prisma.leadActivity.create({
      data: { leadId, type: "RENAME", meta: { summary: `Name set to "${next ?? "(cleared)"}"`, from: lead.name } },
    }),
  ]);
  revalidatePath("/leads");
  revalidatePath("/");
}

export async function toggleLeadBadFit(leadId: string) {
  const scope = await requireDashboardWriteScope();
  const lead = await assertOwnsLead(leadId, scope.clientId);
  const badFit = lead.qualified !== false;
  await prisma.$transaction([
    prisma.serviceLead.update({ where: { id: leadId }, data: { qualified: badFit ? false : null } }),
    prisma.leadActivity.create({ data: { leadId, type: "QUALIFIED_TOGGLE", meta: { badFit } } }),
  ]);
  revalidatePath("/leads");
  revalidatePath("/");
}

// Setting a follow-up date had no client-facing UI at all before this — the
// fields existed (nextActionAt/nextActionLabel) but were only ever written
// by sync routes and backfill scripts. This is the first way a client can
// set one themselves. Clearing (empty date) removes it entirely rather than
// leaving a label with no date behind it.
export async function setLeadFollowUp(leadId: string, dateIso: string | null, label: string): Promise<void> {
  const scope = await requireDashboardWriteScope();
  await assertOwnsLead(leadId, scope.clientId);

  const nextActionAt = dateIso ? new Date(`${dateIso}T12:00:00Z`) : null;
  const nextActionLabel = nextActionAt ? label.trim().slice(0, 80) || "Follow up" : null;

  await prisma.$transaction([
    prisma.serviceLead.update({ where: { id: leadId }, data: { nextActionAt, nextActionLabel } }),
    prisma.leadActivity.create({
      data: {
        leadId,
        type: "NOTE",
        meta: {
          summary: nextActionAt
            ? `Follow-up set for ${nextActionAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}${label.trim() ? ` — ${label.trim()}` : ""}`
            : "Follow-up date cleared",
        },
      },
    }),
  ]);
  revalidatePath("/leads");
}

// Requests a review straight from a lead's own card, using their own name
// and number, rather than making Bryan or Desiree retype it into "What I
// Need From You". Moves the lead into Review Requested — the column already
// exists for exactly this — and notifies Alan the same way the nextsteps
// page's request does, so the two paths behave identically from his side.
export async function requestLeadReview(leadId: string): Promise<void> {
  const scope = await requireDashboardWriteScope();
  const lead = await assertOwnsLead(leadId, scope.clientId);
  if (!lead.phone) throw new Error("This lead has no phone number to request a review with.");

  const customerName = lead.name ?? lead.phone;

  await prisma.$transaction([
    prisma.reviewRequest.create({
      data: {
        clientId: scope.clientId,
        leadId,
        customerName,
        phone: lead.phone,
        jobFinishedAt: new Date(),
        status: "QUEUED",
      },
    }),
    prisma.serviceLead.update({ where: { id: leadId }, data: { stage: "REVIEW_REQUESTED", stageChangedAt: new Date() } }),
    prisma.leadActivity.create({
      data: { leadId, type: "STAGE_MOVE", meta: { from: lead.stage, to: "REVIEW_REQUESTED", summary: "Review requested" } },
    }),
  ]);

  const client = await prisma.client.findUniqueOrThrow({ where: { id: scope.clientId }, select: { name: true } });
  await notify({
    clientId: scope.clientId,
    kind: "REVIEW_REQUEST",
    title: `Review request queued — ${client.name}`,
    message: `${customerName} (${lead.phone}) is ready for a review request.`,
    toClient: false,
  });

  revalidatePath("/leads");
}

// Soft delete. A hard delete would be undone by the next CallRail sync,
// which re-fetches the same call every run. The tombstone also means that if
// this person ever gets in touch again, recordContact() restores their card
// with its full history rather than starting a blank one.
export async function deleteLead(leadId: string) {
  const scope = await requireDashboardWriteScope();
  await assertOwnsLead(leadId, scope.clientId);
  await prisma.serviceLead.update({ where: { id: leadId }, data: { deletedAt: new Date() } });
  revalidatePath("/leads");
  revalidatePath("/");
}
