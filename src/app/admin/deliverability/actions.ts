"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

// Upsert the portal-side metadata for a domain (Smartlead is the source of
// truth for the domain name; we store client/cold-start/note here).
export async function updateDomainMeta(domain: string, formData: FormData) {
  await requireAdmin();
  const clientId = str(formData, "clientId") || null;
  const coldStart = str(formData, "coldStartDate");
  const note = str(formData, "note") || null;
  const data = {
    clientId,
    coldStartDate: coldStart ? new Date(coldStart) : null,
    note,
  };
  await prisma.domain.upsert({
    where: { domain },
    create: { domain, ...data },
    update: data,
  });
  revalidatePath("/admin/deliverability");
}

export async function toggleDomainBurned(domain: string) {
  await requireAdmin();
  const existing = await prisma.domain.findUnique({ where: { domain } });
  await prisma.domain.upsert({
    where: { domain },
    create: { domain, burnedAt: new Date() },
    update: { burnedAt: existing?.burnedAt ? null : new Date() },
  });
  revalidatePath("/admin/deliverability");
}
