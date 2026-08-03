"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDashboardWriteScope } from "@/lib/dashboard-scope";
import { getScopedContext } from "@/lib/auth";
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
