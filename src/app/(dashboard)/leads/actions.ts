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
}

export async function toggleLeadQualified(leadId: string) {
  const scope = await requireDashboardWriteScope();
  const lead = await assertOwnsLead(leadId, scope.clientId);
  const next = lead.qualified !== true;
  await prisma.$transaction([
    prisma.serviceLead.update({ where: { id: leadId }, data: { qualified: next } }),
    prisma.leadActivity.create({ data: { leadId, type: "QUALIFIED_TOGGLE", meta: { qualified: next } } }),
  ]);
  revalidatePath("/leads");
}
