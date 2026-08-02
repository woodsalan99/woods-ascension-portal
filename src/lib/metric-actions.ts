"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// One-click reset next to an overridden number's badge — deletes the
// override row so the next render falls through to the live resolver
// again. Setting a NEW override happens through publishPortalChanges
// (src/lib/content-actions.ts), riding the same diff-review/publish flow
// as copy edits — this is only for the reset side.
export async function resetMetricOverride(clientId: string, scopeKey: string): Promise<void> {
  await requireAdmin();
  await prisma.metricOverride.deleteMany({ where: { clientId, scopeKey } });
  revalidatePath("/", "layout");
}
