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

// ---------- Admin task authoring, from the client's own page ----------
//
// Deliberately NOT admin-only-page work. Alan reads this page in preview far
// more often than he opens the admin panel, and the moment he thinks "they
// need to do X" is while he's looking at it. Guarded on ADMIN, so a real
// client session can never reach any of it. See D41.

async function requireAdminForClient(clientId: string) {
  const ctx = await getScopedContext();
  if (ctx.role !== "ADMIN") throw new Error("Admin only");
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { id: true } });
  return client.id;
}

export type TaskDraft = {
  id?: string;
  title: string;
  explanation: string;
  urgency: string;
  responseType: string;
  dueAt: string | null; // YYYY-MM-DD
};

export async function saveTask(clientId: string, draft: TaskDraft) {
  await requireAdminForClient(clientId);
  const title = draft.title.trim();
  if (!title) throw new Error("A task needs a title");

  const data = {
    title: title.slice(0, 200),
    explanation: draft.explanation.trim().slice(0, 1000),
    urgency: draft.urgency.trim().slice(0, 40) || "This week",
    responseType: draft.responseType,
    // Noon UTC so the date shown never slips a day either side of the
    // international date line — Hawaii is UTC-10.
    dueAt: draft.dueAt ? new Date(`${draft.dueAt}T12:00:00Z`) : null,
  };

  if (draft.id) {
    const existing = await prisma.clientTask.findUniqueOrThrow({ where: { id: draft.id } });
    if (existing.clientId !== clientId) throw new Error("Forbidden");
    await prisma.clientTask.update({ where: { id: draft.id }, data });
  } else {
    const last = await prisma.clientTask.findFirst({
      where: { clientId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    await prisma.clientTask.create({ data: { clientId, ...data, sortOrder: (last?.sortOrder ?? 0) + 1 } });
  }
  revalidatePath("/nextsteps");
  revalidatePath("/", "layout");
}

export async function deleteTask(clientId: string, taskId: string) {
  await requireAdminForClient(clientId);
  const task = await prisma.clientTask.findUniqueOrThrow({ where: { id: taskId } });
  if (task.clientId !== clientId) throw new Error("Forbidden");
  await prisma.clientTask.delete({ where: { id: taskId } });
  revalidatePath("/nextsteps");
  revalidatePath("/", "layout");
}

// Whole-list reorder rather than move-one-up: dragging or nudging repeatedly
// against a server round-trip per step is where off-by-one ordering bugs come
// from. The client sends the order it wants; we write exactly that.
export async function reorderTasks(clientId: string, orderedIds: string[]) {
  await requireAdminForClient(clientId);
  const owned = await prisma.clientTask.findMany({ where: { clientId }, select: { id: true } });
  const ownedIds = new Set(owned.map((t) => t.id));
  if (orderedIds.some((id) => !ownedIds.has(id))) throw new Error("Forbidden");

  await prisma.$transaction(
    orderedIds.map((id, i) => prisma.clientTask.update({ where: { id }, data: { sortOrder: i + 1 } })),
  );
  revalidatePath("/nextsteps");
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
