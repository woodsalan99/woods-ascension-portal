"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

// Admin data entry for LOCAL_SERVICES clients. Everything here is a number
// or an image that no API will give us: Google Ads Local Services reports
// (screenshots only), Local Falcon map exports, Ahrefs CSVs, and the
// month-end recap Alan writes himself.

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v.length > 0 ? v : null;
}
function num(fd: FormData, key: string): number {
  const v = Number(str(fd, key).replace(/[$,%\s,]/g, ""));
  if (!Number.isFinite(v)) throw new Error(`"${key}" must be a number`);
  return v;
}
// Textareas where one line = one item. Blank lines are dropped, so a stray
// return at the end never becomes an empty bullet on the client's page.
function lines(fd: FormData, key: string): string[] {
  return str(fd, key)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}
function assertMonth(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Month must look like 2026-07, got "${month}"`);
  return month;
}

function refresh(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}/local`);
  // The client-facing pages read this data directly.
  revalidatePath("/", "layout");
}

// ---------- Google Local Services Ads: monthly figures ----------

export async function upsertLsaMonth(clientId: string, formData: FormData) {
  await requireAdmin();
  const month = assertMonth(str(formData, "month"));

  await prisma.lsaMonthlyStat.upsert({
    where: { clientId_month: { clientId, month } },
    create: {
      clientId,
      month,
      impressions: Math.round(num(formData, "impressions")),
      topRatePct: num(formData, "topRatePct"),
      absTopRatePct: num(formData, "absTopRatePct"),
      // Entered in dollars because that's what the Google report shows;
      // stored in cents because that's what every other money field uses.
      spendCents: Math.round(num(formData, "spendDollars") * 100),
      chargedLeads: Math.round(num(formData, "chargedLeads")),
    },
    update: {
      impressions: Math.round(num(formData, "impressions")),
      topRatePct: num(formData, "topRatePct"),
      absTopRatePct: num(formData, "absTopRatePct"),
      spendCents: Math.round(num(formData, "spendDollars") * 100),
      chargedLeads: Math.round(num(formData, "chargedLeads")),
    },
  });
  refresh(clientId);
}

export async function deleteLsaMonth(clientId: string, id: string) {
  await requireAdmin();
  await prisma.lsaMonthlyStat.delete({ where: { id } });
  refresh(clientId);
}

// ---------- Local Falcon: map scans ----------

export async function upsertGeogridScan(clientId: string, formData: FormData) {
  await requireAdmin();
  const month = assertMonth(str(formData, "month"));
  const keyword = str(formData, "keyword");
  const locationId = str(formData, "locationId");
  if (!keyword) throw new Error("Keyword is required");
  if (!locationId) throw new Error("Pick a location");

  // Local Falcon reports the ranks as a grid, entered as rows of numbers.
  // 0 means "not found in the top 20" — the resolver and the map renderer
  // both already treat it that way.
  const rows = lines(formData, "grid").map((row) =>
    row
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((n) => {
        const v = Number(n);
        if (!Number.isFinite(v)) throw new Error(`"${n}" in the grid isn't a number`);
        return v;
      }),
  );
  if (rows.length === 0) throw new Error("Paste the grid of ranks");
  const cols = rows[0].length;
  if (rows.some((r) => r.length !== cols)) throw new Error("Every grid row must have the same number of ranks");

  const cells = rows.flat();
  const found = cells.filter((c) => c > 0);
  // A cell where you don't appear at all can't be averaged in as a zero —
  // that would make a bad month look better than a mediocre one. Local
  // Falcon's own convention is to score it at 20, the bottom of the grid.
  const avgRank = cells.length === 0 ? 0 : cells.reduce((a, c) => a + (c > 0 ? c : 20), 0) / cells.length;
  const top3Pct = cells.length === 0 ? 0 : (found.filter((c) => c <= 3).length / cells.length) * 100;

  const existing = await prisma.geogridScan.findUnique({
    where: { clientId_locationId_keyword_month: { clientId, locationId, keyword, month } },
  });

  let mapImage: Uint8Array<ArrayBuffer> | undefined;
  let mapImageType: string | undefined;
  const file = formData.get("mapImage");
  if (file instanceof File && file.size > 0) {
    mapImage = new Uint8Array(await file.arrayBuffer());
    mapImageType = file.type || "image/webp";
  }

  const takenAtRaw = str(formData, "takenAt");
  const takenAt = takenAtRaw ? new Date(takenAtRaw) : new Date();
  const gridJson = { rows: rows.length, cols, cells, radiusMiles: Number(str(formData, "radiusMiles")) || undefined };

  if (existing) {
    await prisma.geogridScan.update({
      where: { id: existing.id },
      // Leaving the file field empty on an edit keeps the existing image
      // rather than wiping it — re-uploading a map to fix a typo in the
      // ranks would be a nasty surprise.
      data: { gridJson, avgRank, top3Pct, takenAt, ...(mapImage ? { mapImage, mapImageType } : {}) },
    });
  } else {
    await prisma.geogridScan.create({
      data: { clientId, locationId, keyword, month, gridJson, avgRank, top3Pct, takenAt, mapImage, mapImageType },
    });
  }
  refresh(clientId);
}

export async function deleteGeogridScan(clientId: string, id: string) {
  await requireAdmin();
  await prisma.geogridScan.delete({ where: { id } });
  refresh(clientId);
}

// ---------- Town pages ----------

export async function upsertSitePage(clientId: string, formData: FormData) {
  await requireAdmin();
  const url = str(formData, "url");
  const town = str(formData, "town");
  if (!url || !town) throw new Error("Town and URL are both required");

  const publishedRaw = str(formData, "publishedAt");
  const publishedAt = publishedRaw ? new Date(publishedRaw) : new Date();
  await prisma.sitePage.upsert({
    where: { clientId_url: { clientId, url } },
    create: { clientId, town, url, publishedAt },
    update: { town, publishedAt },
  });
  refresh(clientId);
}

export async function deleteSitePage(clientId: string, id: string) {
  await requireAdmin();
  await prisma.sitePage.delete({ where: { id } });
  refresh(clientId);
}

// ---------- Ahrefs keyword rankings ----------

// One row per line: keyword, position, volume, url — comma separated, the
// order Ahrefs exports them in. Pasting a whole CSV body works.
export async function importKeywordRanks(clientId: string, formData: FormData) {
  await requireAdmin();
  const month = assertMonth(str(formData, "month"));
  const rows = lines(formData, "csv");

  let imported = 0;
  for (const row of rows) {
    const parts = row.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    const [keyword, positionRaw, volumeRaw, url] = parts;
    if (!keyword || !positionRaw) continue;
    // Skip an Ahrefs header row without making the admin delete it first.
    if (keyword.toLowerCase() === "keyword") continue;
    const position = parseInt(positionRaw, 10);
    if (!Number.isFinite(position)) continue;
    const volume = volumeRaw ? parseInt(volumeRaw.replace(/[,\s]/g, ""), 10) : null;

    const prev = await prisma.keywordRank.findFirst({
      where: { clientId, keyword, month: { lt: month } },
      orderBy: { month: "desc" },
    });

    await prisma.keywordRank.upsert({
      where: { clientId_month_keyword: { clientId, month, keyword } },
      create: {
        clientId,
        month,
        keyword,
        position,
        volume: Number.isFinite(volume as number) ? volume : null,
        prevPosition: prev?.position ?? null,
        url: url ?? "",
      },
      update: {
        position,
        volume: Number.isFinite(volume as number) ? volume : null,
        prevPosition: prev?.position ?? null,
        url: url ?? "",
      },
    });
    imported++;
  }
  console.log(`[admin] imported ${imported} keyword ranks for ${clientId} ${month}`);
  refresh(clientId);
}

// ---------- Work log ----------

export async function addWorkLog(clientId: string, formData: FormData) {
  await requireAdmin();
  const body = str(formData, "body");
  if (!body) throw new Error("Write something first");
  await prisma.workLog.create({ data: { clientId, body, source: "ADMIN_NOTE" } });
  refresh(clientId);
}

export async function deleteWorkLog(clientId: string, id: string) {
  await requireAdmin();
  await prisma.workLog.delete({ where: { id } });
  refresh(clientId);
}

// ---------- Monthly recap ----------

export async function upsertMonthlyWork(clientId: string, formData: FormData) {
  await requireAdmin();
  const month = assertMonth(str(formData, "month"));

  // "What we did" items are entered one per line as `title | detail`. The
  // same list renders on the Overview and in the recap, so it's written once.
  const items = lines(formData, "items").map((line) => {
    const [title, detail = ""] = line.split("|").map((p) => p.trim());
    return { title, detail };
  });

  const data = {
    heroTitleManual: optStr(formData, "heroTitle"),
    heroSubManual: optStr(formData, "heroSub"),
    items,
    nextMonth: lines(formData, "nextMonth"),
    noteFromAlan: optStr(formData, "note"),
  };

  await prisma.monthlyWork.upsert({
    where: { clientId_month: { clientId, month } },
    create: { clientId, month, ...data },
    update: data,
  });
  refresh(clientId);
}

export async function deleteMonthlyWork(clientId: string, id: string) {
  await requireAdmin();
  await prisma.monthlyWork.delete({ where: { id } });
  refresh(clientId);
}

// ---------- Client tasks ----------

export async function upsertClientTask(clientId: string, formData: FormData) {
  await requireAdmin();
  const id = optStr(formData, "id");
  const title = str(formData, "title");
  if (!title) throw new Error("A task needs a title");

  const data = {
    title,
    explanation: str(formData, "explanation"),
    urgency: str(formData, "urgency") || "This week",
    responseType: str(formData, "responseType") || "CHECK",
    sortOrder: Math.round(Number(str(formData, "sortOrder")) || 1),
  };

  if (id) {
    await prisma.clientTask.update({ where: { id }, data });
  } else {
    await prisma.clientTask.create({ data: { clientId, ...data } });
  }
  refresh(clientId);
}

export async function deleteClientTask(clientId: string, id: string) {
  await requireAdmin();
  // Submissions cascade — deleting a task the client already answered would
  // silently bin their answer, so reopen rather than delete if that matters.
  await prisma.clientTask.delete({ where: { id } });
  refresh(clientId);
}
