import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMonthKey } from "@/lib/timezone";
import {
  addWorkItem,
  addWorkLog,
  deleteWorkItem,
  deleteClientTask,
  deleteGeogridScan,
  deleteLsaMonth,
  deleteMonthlyWork,
  deleteSitePage,
  deleteWorkLog,
  importKeywordRanks,
  upsertClientTask,
  upsertGeogridScan,
  upsertLsaMonth,
  upsertMonthlyWork,
  upsertSitePage,
} from "./actions";

// Everything for a local-services client that no API will hand us. Kept off
// the main client page because none of it applies to a cold-email client.

const URGENCIES = ["Highest priority", "This week", "Every job", "Whenever you can", "Overdue"];
const RESPONSE_TYPES = [
  { v: "CHECK", label: "Just tick it off" },
  { v: "TEXT", label: "Type an answer" },
  { v: "PHOTO", label: "Upload photos" },
  { v: "BOTH", label: "Type and upload" },
];

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function LocalServicesAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const client = await prisma.client.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, type: true },
  });
  if (client.type !== "LOCAL_SERVICES") notFound();

  const [lsaMonths, locations, scans, pages, keywordMonths, workLogs, recaps, tasks] = await Promise.all([
    prisma.lsaMonthlyStat.findMany({ where: { clientId: id }, orderBy: { month: "desc" } }),
    prisma.clientLocation.findMany({ where: { clientId: id }, orderBy: { name: "asc" } }),
    prisma.geogridScan.findMany({
      where: { clientId: id },
      orderBy: [{ month: "desc" }, { keyword: "asc" }],
      select: { id: true, month: true, keyword: true, avgRank: true, top3Pct: true, mapImage: false },
    }),
    prisma.sitePage.findMany({ where: { clientId: id }, orderBy: { town: "asc" } }),
    prisma.keywordRank.groupBy({ by: ["month"], where: { clientId: id }, _count: { _all: true } }),
    prisma.workLog.findMany({ where: { clientId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.monthlyWork.findMany({ where: { clientId: id }, orderBy: { month: "desc" } }),
    prisma.clientTask.findMany({ where: { clientId: id }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <main className="p-6 flex flex-col gap-6 max-w-5xl">
      <div>
        <Link href={`/admin/clients/${id}`} className="underline text-sm">
          ← {client.name}
        </Link>
        <h1 className="text-xl font-bold mt-1">Local services data entry</h1>
        <p className="text-gray-500 text-sm">
          The numbers Google and Local Falcon won&apos;t give us through an API. Everything saved here appears on
          the client&apos;s portal immediately.
        </p>
      </div>

      {/* ---------- What we did: the one used most often ---------- */}
      <section className="border p-4 rounded bg-gray-50">
        <h2 className="font-bold mb-1">Log something you did</h2>
        <p className="text-gray-500 text-sm mb-3">
          Goes straight onto their Overview under &quot;what we built for you&quot;, and into that month&apos;s
          recap. The date decides which month it counts for and when it drops off their last-30-days view.
        </p>
        <form action={addWorkItem.bind(null, id)} className="flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-2">
            <label className="text-xs col-span-3">
              What you did
              <input name="title" placeholder="Published 6 more town pages" className="border p-1 w-full" required />
            </label>
            <label className="text-xs">
              When
              <input name="date" type="date" className="border p-1 w-full" />
            </label>
          </div>
          <label className="text-xs">
            A bit more detail (optional) — shown under it on their Overview
            <input name="detail" placeholder="Kailua, Kaneohe, Wahiawa, Haleiwa, Kahala, Manoa" className="border p-1 w-full" />
          </label>
          <button className="bg-black text-white px-3 py-1 rounded w-fit">Add it</button>
        </form>

        {recaps.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-gray-500 mb-1">Logged so far</div>
            {recaps.map((r) => {
              const items = (r.items as { title: string; detail?: string; date?: string }[]) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={r.id} className="mb-2">
                  <div className="text-xs font-bold">{formatMonthKey(r.month)}</div>
                  <ul className="text-sm">
                    {items.map((it, i) => (
                      <li key={i} className="flex gap-2 border-t py-1">
                        <span className="text-gray-500 text-xs w-20 shrink-0">{it.date ?? "no date"}</span>
                        <span className="flex-1">
                          {it.title}
                          {it.detail ? <span className="text-gray-500"> — {it.detail}</span> : null}
                        </span>
                        <form action={deleteWorkItem.bind(null, id, r.month, i)}>
                          <button className="underline text-red-600 text-xs">remove</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------- Google Local Services Ads ---------- */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-1">Google Local Services Ads — monthly</h2>
        <p className="text-gray-500 text-sm mb-3">
          From the Google Ads report screenshot. Re-entering a month you already have overwrites it.
        </p>
        <table className="w-full text-sm mb-3">
          <thead>
            <tr className="text-left">
              <th>Month</th>
              <th>Shown</th>
              <th>Top rate</th>
              <th>Abs top</th>
              <th>Spend</th>
              <th>Charged</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lsaMonths.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="py-1">{formatMonthKey(m.month)}</td>
                <td>{m.impressions.toLocaleString("en-US")}</td>
                <td>{m.topRatePct}%</td>
                <td>{m.absTopRatePct}%</td>
                <td>{money(m.spendCents)}</td>
                <td>{m.chargedLeads}</td>
                <td>
                  <form action={deleteLsaMonth.bind(null, id, m.id)}>
                    <button className="underline text-red-600 text-xs">delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={upsertLsaMonth.bind(null, id)} className="grid grid-cols-6 gap-2 items-end">
          <label className="text-xs">
            Month
            <input name="month" placeholder="2026-08" className="border p-1 w-full" required />
          </label>
          <label className="text-xs">
            Times shown
            <input name="impressions" className="border p-1 w-full" required />
          </label>
          <label className="text-xs">
            Top of search %
            <input name="topRatePct" className="border p-1 w-full" required />
          </label>
          <label className="text-xs">
            Absolute top %
            <input name="absTopRatePct" className="border p-1 w-full" required />
          </label>
          <label className="text-xs">
            Spend ($)
            <input name="spendDollars" placeholder="37.27" className="border p-1 w-full" required />
          </label>
          <div className="flex gap-2">
            <label className="text-xs flex-1">
              Charged leads
              <input name="chargedLeads" className="border p-1 w-full" required />
            </label>
            <button className="bg-black text-white px-3 py-1 rounded h-fit">Save</button>
          </div>
        </form>
      </section>

      {/* ---------- Local Falcon ---------- */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-1">Local Falcon map scans</h2>
        <p className="text-gray-500 text-sm mb-3">
          Paste the grid of ranks, one row per line, and attach the map image. Average rank and top-3 share are
          worked out from the grid — don&apos;t type them in. A blank spot on the map is a <b>0</b>.
        </p>
        <table className="w-full text-sm mb-3">
          <thead>
            <tr className="text-left">
              <th>Month</th>
              <th>Keyword</th>
              <th>Avg rank</th>
              <th>Top 3</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {scans.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="py-1">{formatMonthKey(s.month)}</td>
                <td>{s.keyword}</td>
                <td>{s.avgRank.toFixed(1)}</td>
                <td>{s.top3Pct.toFixed(0)}%</td>
                <td>
                  <form action={deleteGeogridScan.bind(null, id, s.id)}>
                    <button className="underline text-red-600 text-xs">delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {locations.length === 0 ? (
          <p className="text-red-600 text-sm">Add a location on the main client page first.</p>
        ) : (
          <form action={upsertGeogridScan.bind(null, id)} className="flex flex-col gap-2">
            <div className="grid grid-cols-5 gap-2">
              <label className="text-xs">
                Month
                <input name="month" placeholder="2026-08" className="border p-1 w-full" required />
              </label>
              <label className="text-xs">
                Keyword
                <input name="keyword" placeholder="house painters near me" className="border p-1 w-full" required />
              </label>
              <label className="text-xs">
                Location
                <select name="locationId" className="border p-1 w-full">
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Radius (miles)
                <input name="radiusMiles" placeholder="10" className="border p-1 w-full" />
              </label>
              <label className="text-xs">
                Scanned on
                <input name="takenAt" type="date" className="border p-1 w-full" />
              </label>
            </div>
            <label className="text-xs">
              Grid of ranks — one row per line
              <textarea
                name="grid"
                rows={6}
                placeholder={"3 4 6 8 11\n2 3 5 7 9\n1 2 3 6 8"}
                className="border p-1 w-full font-mono"
                required
              />
            </label>
            <label className="text-xs">
              Map image (webp or png)
              <input name="mapImage" type="file" accept="image/*" className="border p-1 w-full" />
            </label>
            <button className="bg-black text-white px-3 py-1 rounded w-fit">Save scan</button>
          </form>
        )}
      </section>

      {/* ---------- Town pages ---------- */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-1">Town pages</h2>
        <p className="text-gray-500 text-sm mb-3">
          Whether Google has picked a page up is set by the Search Console sync — not typed in here.
        </p>
        <table className="w-full text-sm mb-3">
          <tbody>
            {pages.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-1">{p.town}</td>
                <td className="text-gray-500 text-xs">{p.url}</td>
                <td>{p.indexed ? "showing in Google" : "not showing yet"}</td>
                <td>
                  <form action={deleteSitePage.bind(null, id, p.id)}>
                    <button className="underline text-red-600 text-xs">delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={upsertSitePage.bind(null, id)} className="grid grid-cols-4 gap-2 items-end">
          <label className="text-xs">
            Town
            <input name="town" className="border p-1 w-full" required />
          </label>
          <label className="text-xs col-span-2">
            URL
            <input name="url" className="border p-1 w-full" required />
          </label>
          <div className="flex gap-2">
            <label className="text-xs flex-1">
              Published
              <input name="publishedAt" type="date" className="border p-1 w-full" />
            </label>
            <button className="bg-black text-white px-3 py-1 rounded h-fit">Add</button>
          </div>
        </form>
      </section>

      {/* ---------- Ahrefs ---------- */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-1">Ahrefs keyword rankings</h2>
        <p className="text-gray-500 text-sm mb-3">
          Paste rows as <code>keyword, position, volume, url</code>. A header row is ignored. Last month&apos;s
          position is filled in automatically so the portal can show movement.
        </p>
        <p className="text-sm mb-3">
          {keywordMonths.length === 0
            ? "Nothing imported yet."
            : keywordMonths
                .sort((a, b) => b.month.localeCompare(a.month))
                .map((m) => `${formatMonthKey(m.month)}: ${m._count._all}`)
                .join(" · ")}
        </p>
        <form action={importKeywordRanks.bind(null, id)} className="flex flex-col gap-2">
          <label className="text-xs">
            Month
            <input name="month" placeholder="2026-08" className="border p-1 w-40" required />
          </label>
          <textarea name="csv" rows={6} className="border p-1 w-full font-mono text-xs" required />
          <button className="bg-black text-white px-3 py-1 rounded w-fit">Import</button>
        </form>
      </section>

      {/* ---------- Work log ---------- */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-1">Work log</h2>
        <p className="text-gray-500 text-sm mb-3">
          Jot down what you did as you do it. At month end these are what you build the recap from, instead of
          trying to remember.
        </p>
        <form action={addWorkLog.bind(null, id)} className="flex gap-2 mb-3">
          <input name="body" placeholder="Fixed the sitemap so Google crawls town pages faster" className="border p-1 flex-1" required />
          <button className="bg-black text-white px-3 py-1 rounded">Log it</button>
        </form>
        <ul className="text-sm">
          {workLogs.map((w) => (
            <li key={w.id} className="border-t py-1 flex gap-3">
              <span className="text-gray-500 text-xs w-24 shrink-0">
                {w.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <span className="flex-1">{w.body}</span>
              <form action={deleteWorkLog.bind(null, id, w.id)}>
                <button className="underline text-red-600 text-xs">delete</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- Monthly recap ---------- */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-1">Monthly recap</h2>
        <p className="text-gray-500 text-sm mb-3">
          The &quot;what we did&quot; list also becomes the block on their Overview — written once, shown in both
          places. The KPI numbers on the recap are worked out live; you don&apos;t type those.
        </p>
        {recaps.map((r) => {
          const items = (r.items as { title: string; detail?: string; date?: string }[]) ?? [];
          const next = (r.nextMonth as string[]) ?? [];
          return (
            <details key={r.id} className="border-t py-2">
              <summary className="cursor-pointer text-sm">
                <b>{formatMonthKey(r.month)}</b> — {r.heroTitleManual ?? r.heroTitleAuto ?? "no headline yet"}
              </summary>
              <form action={upsertMonthlyWork.bind(null, id)} className="flex flex-col gap-2 mt-3">
                <input type="hidden" name="month" value={r.month} />
                <label className="text-xs">
                  Headline
                  <input
                    name="heroTitle"
                    defaultValue={r.heroTitleManual ?? r.heroTitleAuto ?? ""}
                    className="border p-1 w-full"
                  />
                </label>
                <label className="text-xs">
                  Headline explanation
                  <textarea
                    name="heroSub"
                    rows={3}
                    defaultValue={r.heroSubManual ?? r.heroSubAuto ?? ""}
                    className="border p-1 w-full"
                  />
                </label>
                <label className="text-xs">
                  What we did — one per line, <code>title | detail | date</code>. The date decides when it drops
                  off the client&apos;s &quot;last 30 days&quot; view; leave it off and it counts as month-end.
                  <textarea
                    name="items"
                    rows={5}
                    defaultValue={items
                      .map((i) => [i.title, i.detail ?? "", i.date ?? ""].join(" | ").replace(/ \| $/, ""))
                      .join("\n")}
                    className="border p-1 w-full font-mono text-xs"
                  />
                </label>
                <label className="text-xs">
                  What&apos;s coming next — one per line
                  <textarea name="nextMonth" rows={4} defaultValue={next.join("\n")} className="border p-1 w-full" />
                </label>
                <label className="text-xs">
                  Your note to them
                  <textarea name="note" rows={5} defaultValue={r.noteFromAlan ?? ""} className="border p-1 w-full" />
                </label>
                <div className="flex gap-2">
                  <button className="bg-black text-white px-3 py-1 rounded">Save</button>
                </div>
              </form>
              <form action={deleteMonthlyWork.bind(null, id, r.id)} className="mt-2">
                <button className="underline text-red-600 text-xs">delete this recap</button>
              </form>
            </details>
          );
        })}
        <form action={upsertMonthlyWork.bind(null, id)} className="flex gap-2 items-end mt-3 border-t pt-3">
          <label className="text-xs">
            Start a new month
            <input name="month" placeholder="2026-08" className="border p-1 w-40" required />
          </label>
          <button className="bg-black text-white px-3 py-1 rounded">Create</button>
        </form>
      </section>

      {/* ---------- Client tasks ---------- */}
      <section className="border p-4 rounded">
        <h2 className="font-bold mb-1">What I need from them</h2>
        <p className="text-gray-500 text-sm mb-3">
          These show on their &quot;What I need from you&quot; page. Deleting a task also deletes anything they
          already typed or uploaded against it.
        </p>
        {tasks.map((t) => (
          <details key={t.id} className="border-t py-2">
            <summary className="cursor-pointer text-sm">
              <b>{t.title}</b> — {t.urgency}
              {t.status === "DONE" && " · ticked off"}
            </summary>
            <form action={upsertClientTask.bind(null, id)} className="flex flex-col gap-2 mt-3">
              <input type="hidden" name="id" value={t.id} />
              <label className="text-xs">
                Title
                <input name="title" defaultValue={t.title} className="border p-1 w-full" required />
              </label>
              <label className="text-xs">
                Why it matters — shown when they tap it open
                <textarea name="explanation" rows={3} defaultValue={t.explanation} className="border p-1 w-full" />
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs">
                  Urgency
                  <select name="urgency" defaultValue={t.urgency} className="border p-1 w-full">
                    {URGENCIES.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  How they reply
                  <select name="responseType" defaultValue={t.responseType} className="border p-1 w-full">
                    {RESPONSE_TYPES.map((r) => (
                      <option key={r.v} value={r.v}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  Order
                  <input name="sortOrder" defaultValue={t.sortOrder} className="border p-1 w-full" />
                </label>
              </div>
              <button className="bg-black text-white px-3 py-1 rounded w-fit">Save</button>
            </form>
            <form action={deleteClientTask.bind(null, id, t.id)} className="mt-2">
              <button className="underline text-red-600 text-xs">delete task and their answers</button>
            </form>
          </details>
        ))}
        <form action={upsertClientTask.bind(null, id)} className="flex flex-col gap-2 mt-3 border-t pt-3">
          <div className="grid grid-cols-4 gap-2">
            <label className="text-xs col-span-2">
              New task
              <input name="title" className="border p-1 w-full" required />
            </label>
            <label className="text-xs">
              Urgency
              <select name="urgency" className="border p-1 w-full">
                {URGENCIES.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              How they reply
              <select name="responseType" className="border p-1 w-full">
                {RESPONSE_TYPES.map((r) => (
                  <option key={r.v} value={r.v}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-xs">
            Why it matters
            <textarea name="explanation" rows={2} className="border p-1 w-full" />
          </label>
          <input type="hidden" name="sortOrder" value={tasks.length + 1} />
          <button className="bg-black text-white px-3 py-1 rounded w-fit">Add task</button>
        </form>
      </section>
    </main>
  );
}
