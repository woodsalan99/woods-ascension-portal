"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { monthKeyInTimezone } from "@/lib/timezone";
import { generateFocus, type FocusItem } from "@/lib/generate-focus";
import { Prisma } from "@prisma/client";

// This month's plan, edited from the Overview itself.
//
// It lived only in the recap builder on the admin page, three clicks deep
// behind a collapsed month — Alan couldn't find it, which is a fair verdict
// on the placement rather than on him. It writes to the same
// MonthlyWork.nextMonth field either way, so the plan on the Overview and
// the "what's coming next" list on the recap are one thing. See D47.
const MAX_ITEMS = 12;
const MAX_LEN = 300;

export async function savePlan(clientId: string, items: string[]): Promise<{ ok: true }> {
  await requireAdmin();

  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    select: { timezone: true },
  });
  const month = monthKeyInTimezone(new Date(), client.timezone);

  const clean = items
    .map((i) => i.trim().slice(0, MAX_LEN))
    .filter(Boolean)
    .slice(0, MAX_ITEMS);

  const row = await prisma.monthlyWork.upsert({
    where: { clientId_month: { clientId, month } },
    // A month with a plan but no work logged yet is the normal state at the
    // start of a month, so creating the row with empty items is correct.
    create: { clientId, month, items: [], nextMonth: clean },
    update: { nextMonth: clean },
    include: { client: { select: { name: true } } },
  });

  // Re-draft the "campaign focus" cards from the new plan, unless Alan has
  // written his own — that always wins and is never overwritten silently.
  // Best-effort: a DeepSeek hiccup must never block saving the plan itself.
  if (!row.focusManual) {
    try {
      const items = (row.items as { title: string; detail?: string; recap?: string }[] | null) ?? [];
      const focus = await generateFocus({
        clientName: row.client.name,
        planItems: clean,
        recentWork: items.map((i) => i.recap ?? i.title),
      });
      if (focus.length > 0) {
        await prisma.monthlyWork.update({ where: { id: row.id }, data: { focusAuto: focus } });
      }
    } catch (err) {
      console.error("[savePlan] generateFocus failed, leaving prior focus in place:", err);
    }
  }

  revalidatePath("/");
  revalidatePath("/recap");
  return { ok: true };
}

const MAX_FOCUS_ITEMS = 3;

export async function saveFocus(clientId: string, items: FocusItem[]): Promise<{ ok: true }> {
  await requireAdmin();
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { timezone: true } });
  const month = monthKeyInTimezone(new Date(), client.timezone);

  const clean = items
    .map((i) => ({ icon: i.icon.trim().slice(0, 8), title: i.title.trim().slice(0, 60), body: i.body.trim().slice(0, 300) }))
    .filter((i) => i.title && i.body)
    .slice(0, MAX_FOCUS_ITEMS);

  await prisma.monthlyWork.upsert({
    where: { clientId_month: { clientId, month } },
    create: { clientId, month, items: [], nextMonth: [], focusManual: clean.length > 0 ? clean : undefined },
    update: { focusManual: clean.length > 0 ? clean : Prisma.JsonNull },
  });

  revalidatePath("/");
  return { ok: true };
}
