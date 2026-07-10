"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { inviteUser } from "@/lib/clerk-invite";
import type { MetricCadence, MetricKey, MilestoneState, Role, StepState } from "@prisma/client";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v.length > 0 ? v : null;
}
function optInt(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  return v.length > 0 ? parseInt(v, 10) : null;
}
function optDate(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  return v.length > 0 ? new Date(v) : null;
}

export async function updateClient(clientId: string, formData: FormData) {
  await requireAdmin();
  await prisma.client.update({
    where: { id: clientId },
    data: {
      name: str(formData, "name"),
      heroName: optStr(formData, "heroName"),
      timezone: str(formData, "timezone"),
      status: str(formData, "status"),
      calendarLink: optStr(formData, "calendarLink"),
      intakeFormLink: optStr(formData, "intakeFormLink"),
      launchDate: optStr(formData, "launchDate")
        ? new Date(str(formData, "launchDate"))
        : null,
      domainsLive: optInt(formData, "domainsLive"),
      inboxesWarming: optInt(formData, "inboxesWarming"),
      warmupSends: optInt(formData, "warmupSends"),
      stageLabels: {
        STAGE_1: str(formData, "stage1Label"),
        STAGE_2: str(formData, "stage2Label"),
        STAGE_3: str(formData, "stage3Label"),
        STAGE_4: str(formData, "stage4Label"),
      },
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function createClient(formData: FormData) {
  await requireAdmin();
  const client = await prisma.client.create({
    data: {
      name: str(formData, "name"),
      slug: str(formData, "slug"),
      timezone: str(formData, "timezone") || "America/New_York",
      stageLabels: {
        STAGE_1: "Positive Reply",
        STAGE_2: "Appointment Booked",
        STAGE_3: "Appointment Held",
        STAGE_4: "Deal Closed",
      },
    },
  });
  revalidatePath("/admin");
  return client.id;
}

export async function createCampaign(clientId: string, formData: FormData) {
  await requireAdmin();
  await prisma.campaign.create({
    data: {
      clientId,
      name: str(formData, "name"),
      smartleadCampaignId: str(formData, "smartleadCampaignId"),
      audienceId: optStr(formData, "audienceId"),
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function setCampaignAudience(clientId: string, campaignId: string, formData: FormData) {
  await requireAdmin();
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { audienceId: optStr(formData, "audienceId") },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function toggleCampaignActive(clientId: string, campaignId: string) {
  await requireAdmin();
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { active: !campaign.active },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function deleteCampaign(clientId: string, campaignId: string) {
  await requireAdmin();
  await prisma.campaign.delete({ where: { id: campaignId } });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function createPipelineEntry(clientId: string, formData: FormData) {
  await requireAdmin();
  await prisma.pipelineEntry.create({
    data: {
      clientId,
      audienceId: optStr(formData, "audienceId"),
      stage: str(formData, "stage") as "STAGE_1" | "STAGE_2" | "STAGE_3" | "STAGE_4",
      contactName: str(formData, "contactName"),
      email: optStr(formData, "email"),
      company: str(formData, "company"),
      dealValue: optInt(formData, "dealValue"),
      notes: optStr(formData, "notes"),
      positiveReplyDate: optDate(formData, "positiveReplyDate"),
      discoveryCallDate: optDate(formData, "discoveryCallDate"),
      salesCallDate: optDate(formData, "salesCallDate"),
      closeDate: optDate(formData, "closeDate"),
      callDateTime: optDate(formData, "discoveryCallDate"), // keep legacy field mirrored to the appointment date
      callStatus: optStr(formData, "callStatus"),
      qualified: formData.get("qualified") === "on",
      disqualifiedReason: optStr(formData, "disqualifiedReason"),
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function updatePipelineEntry(clientId: string, entryId: string, formData: FormData) {
  await requireAdmin();
  await prisma.pipelineEntry.update({
    where: { id: entryId },
    data: {
      audienceId: optStr(formData, "audienceId"),
      stage: str(formData, "stage") as "STAGE_1" | "STAGE_2" | "STAGE_3" | "STAGE_4",
      contactName: str(formData, "contactName"),
      email: optStr(formData, "email"),
      company: str(formData, "company"),
      dealValue: optInt(formData, "dealValue"),
      notes: optStr(formData, "notes"),
      positiveReplyDate: optDate(formData, "positiveReplyDate"),
      discoveryCallDate: optDate(formData, "discoveryCallDate"),
      salesCallDate: optDate(formData, "salesCallDate"),
      closeDate: optDate(formData, "closeDate"),
      callDateTime: optDate(formData, "discoveryCallDate"), // keep legacy field mirrored to the appointment date
      callStatus: optStr(formData, "callStatus"),
      qualified: formData.get("qualified") === "on",
      disqualifiedReason: optStr(formData, "disqualifiedReason"),
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function deletePipelineEntry(clientId: string, entryId: string) {
  await requireAdmin();
  await prisma.pipelineEntry.delete({ where: { id: entryId } });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function createMilestone(clientId: string, formData: FormData) {
  await requireAdmin();
  const count = await prisma.milestone.count({ where: { clientId } });
  await prisma.milestone.create({
    data: {
      clientId,
      label: str(formData, "label"),
      subLabel: optStr(formData, "subLabel"),
      state: str(formData, "state") as MilestoneState,
      targetValue: optInt(formData, "targetValue"),
      currentValue: optInt(formData, "currentValue"),
      sortOrder: count + 1,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function updateMilestone(clientId: string, milestoneId: string, formData: FormData) {
  await requireAdmin();
  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      label: str(formData, "label"),
      subLabel: optStr(formData, "subLabel"),
      state: str(formData, "state") as MilestoneState,
      targetValue: optInt(formData, "targetValue"),
      currentValue: optInt(formData, "currentValue"),
      sortOrder: optInt(formData, "sortOrder") ?? 0,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function deleteMilestone(clientId: string, milestoneId: string) {
  await requireAdmin();
  await prisma.milestone.delete({ where: { id: milestoneId } });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function createOnboardingStep(clientId: string, formData: FormData) {
  await requireAdmin();
  const count = await prisma.onboardingStep.count({ where: { clientId } });
  await prisma.onboardingStep.create({
    data: {
      clientId,
      label: str(formData, "label"),
      dayLabel: str(formData, "dayLabel"),
      state: str(formData, "state") as StepState,
      ctaLabel: optStr(formData, "ctaLabel"),
      ctaUrl: optStr(formData, "ctaUrl"),
      clientActionable: formData.get("clientActionable") === "on",
      sortOrder: count + 1,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function updateOnboardingStep(clientId: string, stepId: string, formData: FormData) {
  await requireAdmin();
  await prisma.onboardingStep.update({
    where: { id: stepId },
    data: {
      label: str(formData, "label"),
      dayLabel: str(formData, "dayLabel"),
      state: str(formData, "state") as StepState,
      ctaLabel: optStr(formData, "ctaLabel"),
      ctaUrl: optStr(formData, "ctaUrl"),
      clientActionable: formData.get("clientActionable") === "on",
      sortOrder: optInt(formData, "sortOrder") ?? 0,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function deleteOnboardingStep(clientId: string, stepId: string) {
  await requireAdmin();
  await prisma.onboardingStep.delete({ where: { id: stepId } });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function createWeeklyNote(clientId: string, formData: FormData) {
  await requireAdmin();
  await prisma.weeklyNote.create({
    data: {
      clientId,
      weekOf: new Date(str(formData, "weekOf")),
      headline: str(formData, "headline"),
      body: str(formData, "body"),
      videoUrl: optStr(formData, "videoUrl"),
      published: formData.get("published") === "on",
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function toggleNotePublished(clientId: string, noteId: string) {
  await requireAdmin();
  const note = await prisma.weeklyNote.findUniqueOrThrow({ where: { id: noteId } });
  await prisma.weeklyNote.update({
    where: { id: noteId },
    data: { published: !note.published },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function deleteWeeklyNote(clientId: string, noteId: string) {
  await requireAdmin();
  await prisma.weeklyNote.delete({ where: { id: noteId } });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function inviteUserAction(clientId: string, formData: FormData) {
  await requireAdmin();
  const email = str(formData, "email");
  const role = str(formData, "role") as Role;
  await inviteUser({ email, role, clientId: role === "CLIENT" ? clientId : undefined });
  revalidatePath(`/admin/clients/${clientId}`);
}

// --- v1.1: Audiences, Infrastructure, Metric configs ---

export async function createAudience(clientId: string, formData: FormData) {
  await requireAdmin();
  const count = await prisma.audience.count({ where: { clientId } });
  await prisma.audience.create({
    data: { clientId, name: str(formData, "name"), sortOrder: count + 1 },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function renameAudience(clientId: string, audienceId: string, formData: FormData) {
  await requireAdmin();
  await prisma.audience.update({
    where: { id: audienceId },
    data: { name: str(formData, "name") },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function deleteAudience(clientId: string, audienceId: string) {
  await requireAdmin();
  await prisma.audienceDailyStat.deleteMany({ where: { audienceId } });
  await prisma.campaign.updateMany({ where: { audienceId }, data: { audienceId: null } });
  await prisma.pipelineEntry.updateMany({ where: { audienceId }, data: { audienceId: null } });
  await prisma.audience.delete({ where: { id: audienceId } });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function createInfrastructureItem(clientId: string, formData: FormData) {
  await requireAdmin();
  const count = await prisma.infrastructureItem.count({ where: { clientId } });
  await prisma.infrastructureItem.create({
    data: {
      clientId,
      label: str(formData, "label"),
      quantity: optInt(formData, "quantity") ?? 0,
      status: str(formData, "status"),
      monthlyCost: optInt(formData, "monthlyCost") ?? 0,
      notes: optStr(formData, "notes"),
      sortOrder: count + 1,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function updateInfrastructureItem(clientId: string, itemId: string, formData: FormData) {
  await requireAdmin();
  await prisma.infrastructureItem.update({
    where: { id: itemId },
    data: {
      label: str(formData, "label"),
      quantity: optInt(formData, "quantity") ?? 0,
      status: str(formData, "status"),
      monthlyCost: optInt(formData, "monthlyCost") ?? 0,
      notes: optStr(formData, "notes"),
      sortOrder: optInt(formData, "sortOrder") ?? 0,
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function deleteInfrastructureItem(clientId: string, itemId: string) {
  await requireAdmin();
  await prisma.infrastructureItem.delete({ where: { id: itemId } });
  revalidatePath(`/admin/clients/${clientId}`);
}

function optFloat(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  return v.length > 0 ? parseFloat(v) : null;
}

export async function upsertMetricConfig(clientId: string, metricKey: MetricKey, formData: FormData) {
  await requireAdmin();
  const tips = [str(formData, "tip1"), str(formData, "tip2")].filter((t) => t.length > 0);
  const data = {
    cadence: str(formData, "cadence") as MetricCadence,
    targetMin: optFloat(formData, "targetMin"),
    targetMax: optFloat(formData, "targetMax"),
    tips,
  };
  await prisma.metricConfig.upsert({
    where: { clientId_metricKey: { clientId, metricKey } },
    create: { clientId, metricKey, sortOrder: 0, ...data },
    update: data,
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function createChangelogEntry(clientId: string, formData: FormData) {
  await requireAdmin();
  await prisma.changelogEntry.create({
    data: {
      clientId,
      date: new Date(str(formData, "date")),
      title: str(formData, "title"),
      body: optStr(formData, "body"),
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function deleteChangelogEntry(clientId: string, entryId: string) {
  await requireAdmin();
  await prisma.changelogEntry.delete({ where: { id: entryId } });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function uploadDocument(clientId: string, formData: FormData) {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file provided");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  await prisma.document.create({
    data: {
      clientId,
      name: str(formData, "name") || file.name,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      data: bytes,
      note: optStr(formData, "note"),
      docDate: str(formData, "docDate") ? new Date(str(formData, "docDate")) : new Date(),
    },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function deleteDocument(clientId: string, documentId: string) {
  await requireAdmin();
  await prisma.document.delete({ where: { id: documentId } });
  revalidatePath(`/admin/clients/${clientId}`);
}
