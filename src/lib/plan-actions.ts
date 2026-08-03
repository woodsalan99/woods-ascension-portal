"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { monthKeyInTimezone } from "@/lib/timezone";

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

  await prisma.monthlyWork.upsert({
    where: { clientId_month: { clientId, month } },
    // A month with a plan but no work logged yet is the normal state at the
    // start of a month, so creating the row with empty items is correct.
    create: { clientId, month, items: [], nextMonth: clean },
    update: { nextMonth: clean },
  });

  revalidatePath("/");
  revalidatePath("/recap");
  return { ok: true };
}
