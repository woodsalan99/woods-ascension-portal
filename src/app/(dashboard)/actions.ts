"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/auth";

// v1.1 / D21: the only CLIENT-role write paths in the app. Each one
// re-fetches the target row and checks clientId against the caller's own
// scoped clientId before writing — never trust an ID passed from the
// client alone, same tenancy guarantee as every read (§4, Module B).

export async function updateAppointmentOutcome(entryId: string, formData: FormData) {
  const ctx = await requireClient();
  const entry = await prisma.pipelineEntry.findUniqueOrThrow({ where: { id: entryId } });
  if (entry.clientId !== ctx.clientId) {
    throw new Error("Forbidden");
  }

  const outcome = String(formData.get("outcome") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  const outcomeData =
    outcome === "QUALIFIED"
      ? { qualified: true, disqualifiedReason: null, callStatus: "HELD" }
      : outcome === "NO_SHOW"
        ? { qualified: false, disqualifiedReason: "No show", callStatus: "NO_SHOW" }
        : outcome === "NOT_QUALIFIED"
          ? { qualified: false, disqualifiedReason: "Not qualified", callStatus: "HELD" }
          : {}; // PENDING — leave qualified/callStatus untouched

  await prisma.pipelineEntry.update({
    where: { id: entryId },
    data: { ...outcomeData, notes: notes.length > 0 ? notes : null },
  });

  revalidatePath("/appointments");
  revalidatePath("/");
}

// Client-facing "add appointment" (v1.1 batch 6, D21 extension): clients can
// log a new appointment themselves — a new booked lead + its first call.
// Create-only; deleting/editing pipeline entries stays admin-only. Since it
// writes to the same PipelineEntry/PipelineCall tables the admin panel reads,
// it shows up there automatically — no separate sync needed.
export async function addAppointment(formData: FormData) {
  const ctx = await requireClient();

  const contactName = String(formData.get("contactName") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const type = String(formData.get("type") ?? "DISCOVERY");
  const dateStr = String(formData.get("date") ?? "");

  if (!contactName || !dateStr) {
    throw new Error("Contact name and date are required");
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  const entry = await prisma.pipelineEntry.create({
    data: {
      clientId: ctx.clientId,
      stage: "STAGE_2",
      contactName,
      company: company || contactName,
      email: email || null,
      callDateTime: date,
      callStatus: "CONFIRMED",
      qualified: true,
      calls: { create: { type: type === "SALES" ? "SALES" : "DISCOVERY", date } },
    },
  });

  revalidatePath("/appointments");
  revalidatePath("/");
  return entry.id;
}

export async function completeOnboardingStep(stepId: string) {
  const ctx = await requireClient();
  const step = await prisma.onboardingStep.findUniqueOrThrow({ where: { id: stepId } });
  if (step.clientId !== ctx.clientId) {
    throw new Error("Forbidden");
  }
  if (!step.clientActionable) {
    throw new Error("This step cannot be completed by the client");
  }

  await prisma.onboardingStep.update({ where: { id: stepId }, data: { state: "DONE" } });

  revalidatePath("/roadmap");
  revalidatePath("/");
}
