"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { LS_CONTENT, type ContentKey, type ContentEntry } from "@/content/local-services";

function isListEntry(entry: ContentEntry): entry is Extract<ContentEntry, { kind: "list" }> {
  return "kind" in entry && entry.kind === "list";
}

const CONTENT_KEYS = Object.keys(LS_CONTENT) as [ContentKey, ...ContentKey[]];

const ContentChangeSchema = z.object({
  key: z.enum(CONTENT_KEYS),
  value: z.string(),
});

const OverrideChangeSchema = z.object({
  scopeKey: z.string().min(1).max(200),
  value: z.string().min(1).max(200),
  originalValue: z.string().max(200),
});

const PublishSchema = z.object({
  clientId: z.string().min(1),
  changes: z.array(ContentChangeSchema),
  overrides: z.array(OverrideChangeSchema),
});

export type PublishError = { key: string; message: string };

// Validates one content value against its registry entry's constraints —
// plain text length cap for text keys, item-count-agnostic JSON array of
// plain strings (each under maxItem) for list keys. Throws on the first
// violation; server actions never trust client-side validation alone.
function validateContentValue(key: ContentKey, value: string): void {
  const entry: ContentEntry = LS_CONTENT[key];
  if (isListEntry(entry)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(`"${key}": expected a JSON array of strings`);
    }
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
      throw new Error(`"${key}": expected a JSON array of strings`);
    }
    const maxItem = entry.maxItem ?? 500;
    for (const item of parsed) {
      if (item.length > maxItem) throw new Error(`"${key}": an item exceeds ${maxItem} characters`);
    }
    return;
  }
  const max = entry.max ?? 1000;
  if (value.length > max) throw new Error(`"${key}": exceeds ${max} characters`);
}

// Publish is the ONLY way local-services copy/data edits reach the
// database — there is no autosave anywhere in admin edit mode (client task
// submissions are a different, intentionally-autosaving system). Admin
// ROLE is required; the preview cookie alone is not sufficient — any admin
// can publish for any client, same trust model as the rest of the admin
// panel (e.g. upsertMetricConfig).
export async function publishPortalChanges(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const parsed = PublishSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { clientId, changes, overrides } = parsed.data;

  try {
    for (const c of changes) validateContentValue(c.key, c.value);

    await prisma.$transaction([
      ...changes.map((c) =>
        prisma.portalContent.upsert({
          where: { clientId_key: { clientId, key: c.key } },
          create: { clientId, key: c.key, value: c.value },
          update: { value: c.value },
        }),
      ),
      ...overrides.map((o) =>
        prisma.metricOverride.upsert({
          where: { clientId_scopeKey: { clientId, scopeKey: o.scopeKey } },
          create: { clientId, scopeKey: o.scopeKey, value: o.value, originalValue: o.originalValue },
          update: { value: o.value, originalValue: o.originalValue },
        }),
      ),
    ]);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function resetContentOverride(clientId: string, key: ContentKey): Promise<void> {
  await requireAdmin();
  await prisma.portalContent.deleteMany({ where: { clientId, key } });
  revalidatePath("/", "layout");
}
