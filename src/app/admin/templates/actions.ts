"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { MetricCadence, MetricKey, StepState } from "@prisma/client";

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
function optFloat(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  return v.length > 0 ? parseFloat(v) : null;
}

export async function createTemplate(formData: FormData) {
  await requireAdmin();
  const template = await prisma.template.create({ data: { name: str(formData, "name") } });
  revalidatePath("/admin/templates");
  return template.id;
}

export async function deleteTemplate(templateId: string) {
  await requireAdmin();
  await prisma.template.delete({ where: { id: templateId } });
  revalidatePath("/admin/templates");
}

// ---------- onboarding steps ----------

export async function createTemplateStep(templateId: string, formData: FormData) {
  await requireAdmin();
  const count = await prisma.templateOnboardingStep.count({ where: { templateId } });
  await prisma.templateOnboardingStep.create({
    data: {
      templateId,
      label: str(formData, "label"),
      description: optStr(formData, "description"),
      dayLabel: str(formData, "dayLabel"),
      ctaLabel: optStr(formData, "ctaLabel"),
      ctaUrl: optStr(formData, "ctaUrl"),
      clientActionable: formData.get("clientActionable") === "on",
      sortOrder: count + 1,
    },
  });
  revalidatePath(`/admin/templates/${templateId}`);
}

export async function updateTemplateStep(templateId: string, stepId: string, formData: FormData) {
  await requireAdmin();
  await prisma.templateOnboardingStep.update({
    where: { id: stepId },
    data: {
      label: str(formData, "label"),
      description: optStr(formData, "description"),
      dayLabel: str(formData, "dayLabel"),
      ctaLabel: optStr(formData, "ctaLabel"),
      ctaUrl: optStr(formData, "ctaUrl"),
      clientActionable: formData.get("clientActionable") === "on",
      sortOrder: optInt(formData, "sortOrder") ?? 0,
    },
  });
  revalidatePath(`/admin/templates/${templateId}`);
}

export async function deleteTemplateStep(templateId: string, stepId: string) {
  await requireAdmin();
  await prisma.templateOnboardingStep.delete({ where: { id: stepId } });
  revalidatePath(`/admin/templates/${templateId}`);
}

// ---------- metric configs ----------

export async function upsertTemplateMetric(templateId: string, metricKey: MetricKey, formData: FormData) {
  await requireAdmin();
  const tips = [str(formData, "tip1"), str(formData, "tip2")].filter((t) => t.length > 0);
  const data = {
    cadence: str(formData, "cadence") as MetricCadence,
    targetMin: optFloat(formData, "targetMin"),
    targetMax: optFloat(formData, "targetMax"),
    tips,
  };
  await prisma.templateMetricConfig.upsert({
    where: { templateId_metricKey: { templateId, metricKey } },
    create: { templateId, metricKey, sortOrder: 0, ...data },
    update: data,
  });
  revalidatePath(`/admin/templates/${templateId}`);
}

// ---------- milestones ----------

export async function createTemplateMilestone(templateId: string, formData: FormData) {
  await requireAdmin();
  const count = await prisma.templateMilestone.count({ where: { templateId } });
  await prisma.templateMilestone.create({
    data: {
      templateId,
      label: str(formData, "label"),
      subLabel: optStr(formData, "subLabel"),
      targetValue: optInt(formData, "targetValue"),
      sortOrder: count + 1,
    },
  });
  revalidatePath(`/admin/templates/${templateId}`);
}

export async function updateTemplateMilestone(templateId: string, milestoneId: string, formData: FormData) {
  await requireAdmin();
  await prisma.templateMilestone.update({
    where: { id: milestoneId },
    data: {
      label: str(formData, "label"),
      subLabel: optStr(formData, "subLabel"),
      targetValue: optInt(formData, "targetValue"),
      sortOrder: optInt(formData, "sortOrder") ?? 0,
    },
  });
  revalidatePath(`/admin/templates/${templateId}`);
}

export async function deleteTemplateMilestone(templateId: string, milestoneId: string) {
  await requireAdmin();
  await prisma.templateMilestone.delete({ where: { id: milestoneId } });
  revalidatePath(`/admin/templates/${templateId}`);
}

// ---------- apply to a client ----------

// Copies a template's steps/metrics/milestones into a client's real
// OnboardingStep/MetricConfig/Milestone rows. Additive (appends alongside
// whatever the client already has) — intended mainly for a freshly created,
// empty client, not for repeatedly re-applying onto an in-progress one.
export async function applyTemplate(clientId: string, formData: FormData) {
  await requireAdmin();
  const templateId = str(formData, "templateId");
  if (!templateId) throw new Error("Template required");

  const template = await prisma.template.findUniqueOrThrow({
    where: { id: templateId },
    include: { steps: true, metrics: true, milestones: true },
  });

  const existingStepCount = await prisma.onboardingStep.count({ where: { clientId } });
  if (template.steps.length > 0) {
    await prisma.onboardingStep.createMany({
      data: template.steps.map((s, i) => ({
        clientId,
        label: s.label,
        description: s.description,
        dayLabel: s.dayLabel,
        state: "NEXT" as StepState,
        ctaLabel: s.ctaLabel,
        ctaUrl: s.ctaUrl,
        clientActionable: s.clientActionable,
        sortOrder: existingStepCount + i + 1,
      })),
    });
  }

  for (const m of template.metrics) {
    await prisma.metricConfig.upsert({
      where: { clientId_metricKey: { clientId, metricKey: m.metricKey } },
      create: {
        clientId,
        metricKey: m.metricKey,
        cadence: m.cadence,
        targetMin: m.targetMin,
        targetMax: m.targetMax,
        tips: m.tips as string[],
        sortOrder: m.sortOrder,
      },
      update: {
        cadence: m.cadence,
        targetMin: m.targetMin,
        targetMax: m.targetMax,
        tips: m.tips as string[],
      },
    });
  }

  const existingMilestoneCount = await prisma.milestone.count({ where: { clientId } });
  if (template.milestones.length > 0) {
    await prisma.milestone.createMany({
      data: template.milestones.map((m, i) => ({
        clientId,
        label: m.label,
        subLabel: m.subLabel,
        state: "NEXT" as const,
        targetValue: m.targetValue,
        currentValue: null,
        sortOrder: existingMilestoneCount + i + 1,
      })),
    });
  }

  revalidatePath(`/admin/clients/${clientId}`);
}
