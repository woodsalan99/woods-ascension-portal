"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDashboardWriteScope } from "@/lib/dashboard-scope";
import { getScopedContext } from "@/lib/auth";
import { notify } from "@/lib/notify";

// Client-side writes for "What I need from you".
//
// These DO autosave — deliberately, and in contrast to admin edit mode
// which never does. This is the client typing their own answer; losing it
// to a stray tap would be the worst outcome. See handoff §1.4.
const MAX_TEXT = 5000;
const MAX_PHOTO_BYTES = 400 * 1024; // browser downsizes to ~50KB; this is a backstop

async function assertOwnsTask(taskId: string, clientId: string) {
  const task = await prisma.clientTask.findUniqueOrThrow({ where: { id: taskId } });
  if (task.clientId !== clientId) throw new Error("Forbidden");
  return task;
}

// Pings Alan the first time a submission carries real content, then stays
// quiet — nobody wants a notification per keystroke-debounce.
async function notifyFirstSubmission(params: {
  clientId: string;
  submissionId: string;
  taskTitle: string;
  clientName: string;
  what: string;
}) {
  const sub = await prisma.taskSubmission.findUniqueOrThrow({ where: { id: params.submissionId } });
  if (sub.notifiedAt) return;
  await prisma.taskSubmission.update({ where: { id: params.submissionId }, data: { notifiedAt: new Date() } });
  await notify({
    clientId: params.clientId,
    kind: "TASK_SUBMISSION",
    title: `${params.clientName} replied: ${params.taskTitle}`.slice(0, 120),
    message: params.what.slice(0, 240),
    toClient: false, // this one is for Alan, not the client
  });
}

export async function saveTaskText(taskId: string, text: string) {
  const scope = await requireDashboardWriteScope();
  const ctx = await getScopedContext();
  const task = await assertOwnsTask(taskId, scope.clientId);
  const value = text.slice(0, MAX_TEXT);

  const existing = await prisma.taskSubmission.findFirst({
    where: { taskId, kind: "TEXT", submittedByUserId: ctx.userId },
  });

  const submission = existing
    ? await prisma.taskSubmission.update({ where: { id: existing.id }, data: { textValue: value } })
    : await prisma.taskSubmission.create({
        data: { taskId, kind: "TEXT", textValue: value, submittedByUserId: ctx.userId },
      });

  const client = await prisma.client.findUniqueOrThrow({ where: { id: scope.clientId }, select: { name: true } });
  if (value.trim().length > 0) {
    await notifyFirstSubmission({
      clientId: scope.clientId,
      submissionId: submission.id,
      taskTitle: task.title,
      clientName: client.name,
      what: value,
    });
  }

  revalidatePath("/nextsteps");
  return { ok: true as const, savedAt: new Date().toISOString() };
}

export async function addTaskPhoto(taskId: string, dataUrl: string, fileName: string) {
  const scope = await requireDashboardWriteScope();
  const ctx = await getScopedContext();
  const task = await assertOwnsTask(taskId, scope.clientId);

  // The browser has already resized and re-encoded to webp; this only
  // guards against a client that skipped that step.
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("That doesn't look like an image.");
  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length > MAX_PHOTO_BYTES) {
    throw new Error("That photo is too large to store — try a smaller one.");
  }

  const submission = await prisma.taskSubmission.create({
    data: {
      taskId,
      kind: "PHOTO",
      fileData: new Uint8Array(bytes),
      fileType: mime,
      fileName: fileName.slice(0, 120),
      submittedByUserId: ctx.userId,
    },
  });

  const client = await prisma.client.findUniqueOrThrow({ where: { id: scope.clientId }, select: { name: true } });
  await notifyFirstSubmission({
    clientId: scope.clientId,
    submissionId: submission.id,
    taskTitle: task.title,
    clientName: client.name,
    what: "Sent a photo.",
  });

  revalidatePath("/nextsteps");
  return { ok: true as const, id: submission.id };
}

export async function deleteTaskPhoto(submissionId: string) {
  const scope = await requireDashboardWriteScope();
  const sub = await prisma.taskSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { task: true },
  });
  if (sub.task.clientId !== scope.clientId) throw new Error("Forbidden");
  await prisma.taskSubmission.delete({ where: { id: submissionId } });
  revalidatePath("/nextsteps");
}

export async function toggleTaskDone(taskId: string) {
  const scope = await requireDashboardWriteScope();
  const task = await assertOwnsTask(taskId, scope.clientId);
  const done = task.status !== "DONE";
  await prisma.clientTask.update({
    where: { id: taskId },
    data: { status: done ? "DONE" : "OPEN", completedAt: done ? new Date() : null },
  });
  revalidatePath("/nextsteps");
  revalidatePath("/", "layout"); // the nav badge counts open tasks
}

export async function addReviewRequest(formData: FormData) {
  const scope = await requireDashboardWriteScope();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const finishedRaw = String(formData.get("jobFinishedAt") ?? "").trim();

  if (!customerName || !phone) throw new Error("Please add both a name and a phone number.");
  const jobFinishedAt = finishedRaw ? new Date(finishedRaw) : new Date();

  await prisma.reviewRequest.create({
    data: { clientId: scope.clientId, customerName, phone, jobFinishedAt, status: "QUEUED" },
  });

  const client = await prisma.client.findUniqueOrThrow({ where: { id: scope.clientId }, select: { name: true } });
  await notify({
    clientId: scope.clientId,
    kind: "REVIEW_REQUEST",
    title: `Review request queued — ${client.name}`,
    message: `${customerName} (${phone}) is ready for a review request.`,
    toClient: false,
  });

  revalidatePath("/nextsteps");
}
