import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { LS_CONTENT, type ContentKey, type ContentEntry } from "@/content/local-services";

function isListEntry(entry: ContentEntry): entry is Extract<ContentEntry, { kind: "list" }> {
  return "kind" in entry && entry.kind === "list";
}

// Resolution is always `override ?? registry default`. Cached per request
// (React cache()) so a page that reads many keys only queries once.
export const getContent = cache(async (clientId: string) => {
  const rows = await prisma.portalContent.findMany({ where: { clientId } });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  return {
    text(key: ContentKey): string {
      const override = byKey.get(key);
      if (override !== undefined) return override;
      const entry: ContentEntry = LS_CONTENT[key];
      if (isListEntry(entry)) throw new Error(`content key "${key}" is a list — use list() instead of text()`);
      return entry.def;
    },
    list(key: ContentKey): string[] {
      const override = byKey.get(key);
      const entry: ContentEntry = LS_CONTENT[key];
      if (!isListEntry(entry)) throw new Error(`content key "${key}" is not a list — use text() instead of list()`);
      if (override === undefined) return entry.def;
      try {
        const parsed = JSON.parse(override);
        return Array.isArray(parsed) ? parsed : entry.def;
      } catch {
        return entry.def;
      }
    },
  };
});

export { parseCopyMarkup, type CopyRun } from "@/lib/copy-markup";
