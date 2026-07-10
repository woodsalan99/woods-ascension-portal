import { prisma } from "@/lib/prisma";
import {
  fetchDomainHealth,
  fetchDomainInboxMeta,
  type DomainHealth,
  type DomainMeta,
} from "@/lib/smartlead";
import {
  evaluateDomain,
  evaluateDivergence,
  daysBetween,
  MIN_SENDS_FOR_SIGNAL,
  type DomainStatus,
  type DivergenceStatus,
} from "@/lib/deliverability";
import { updateDomainMeta, toggleDomainBurned } from "./actions";

export const dynamic = "force-dynamic";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const STATUS_STYLE: Record<DomainStatus, { bg: string; fg: string; label: string }> = {
  GREEN: { bg: "#E7F1EB", fg: "#1E6B4F", label: "Healthy" },
  YELLOW: { bg: "#F5EDDE", fg: "#A87E3F", label: "Slowdown" },
  RED: { bg: "#F6E3DC", fg: "#A9502F", label: "Compromised" },
  INSUFFICIENT: { bg: "#EDEDE5", fg: "#77828F", label: "Low volume" },
};

const DIVERGENCE_STYLE: Record<DivergenceStatus, { bg: string; fg: string; label: string }> = {
  OK: { bg: "#E7F1EB", fg: "#1E6B4F", label: "In line" },
  UNDERPERFORMING: { bg: "#F5EDDE", fg: "#A87E3F", label: "Underperforming" },
  LIKELY_HIT: { bg: "#F6E3DC", fg: "#A9502F", label: "Likely hit" },
};

export default async function DeliverabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: clientFilter } = await searchParams;

  const now = new Date();
  const d14 = new Date(now.getTime() - 14 * 86_400_000);
  const d28 = new Date(now.getTime() - 28 * 86_400_000);

  let recent: DomainHealth[] = [];
  let prior: DomainHealth[] = [];
  let meta: Map<string, DomainMeta> = new Map();
  let apiError: string | null = null;
  try {
    [recent, prior, meta] = await Promise.all([
      fetchDomainHealth(ymd(d14), ymd(now)),
      fetchDomainHealth(ymd(d28), ymd(d14)),
      fetchDomainInboxMeta(),
    ]);
  } catch (e) {
    apiError = e instanceof Error ? e.message : String(e);
  }

  const recentByDomain = new Map(recent.map((r) => [r.domain, r]));
  const priorByDomain = new Map(prior.map((r) => [r.domain, r]));

  const [clients, domainMetas] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.domain.findMany(),
  ]);
  const dbByDomain = new Map(domainMetas.map((d) => [d.domain, d]));

  // Only show domains that had sending activity in either window.
  const activeDomains = new Set<string>([...recentByDomain.keys(), ...priorByDomain.keys()]);

  const rows = [...activeDomains]
    .map((domain) => {
      const vm = evaluateDomain(recentByDomain.get(domain), priorByDomain.get(domain));
      const m = meta.get(domain);
      const db = dbByDomain.get(domain);
      const age = m ? daysBetween(new Date(m.oldestCreatedAt), now) : null;
      const coldAge = db?.coldStartDate ? daysBetween(db.coldStartDate, now) : null;
      return { vm, inboxCount: m?.inboxCount ?? null, age, coldAge, db };
    })
    .filter((r) => !clientFilter || r.db?.clientId === clientFilter)
    // worst status first
    .sort((a, b) => {
      const order = { RED: 0, YELLOW: 1, GREEN: 2, INSUFFICIENT: 3 };
      return order[a.vm.status] - order[b.vm.status];
    });

  // ---- View #2: per-client domain divergence (last 14 days) ----
  // Group each client's assigned, active domains; compute the client's
  // aggregate reply/bounce from raw counts, then flag domains that diverge.
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const byClient = new Map<string, typeof recent>();
  for (const r of recent) {
    const cid = dbByDomain.get(r.domain)?.clientId;
    if (!cid) continue;
    if (clientFilter && cid !== clientFilter) continue;
    const arr = byClient.get(cid) ?? [];
    arr.push(r);
    byClient.set(cid, arr);
  }

  const divergenceGroups = [...byClient.entries()]
    .map(([cid, domains]) => {
      const totalSent = domains.reduce((s, d) => s + d.sent, 0);
      const totalReplied = domains.reduce((s, d) => s + d.replied, 0);
      const totalBounced = domains.reduce((s, d) => s + d.bounced, 0);
      const clientReplyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;
      const clientBounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
      const rows = domains
        .map((d) =>
          evaluateDivergence({
            domain: d.domain,
            sent: d.sent,
            replyRate: d.replyRate,
            bounceRate: d.bounceRate,
            clientReplyRate,
            clientBounceRate,
          }),
        )
        .sort((a, b) => {
          const order = { LIKELY_HIT: 0, UNDERPERFORMING: 1, OK: 2 };
          return order[a.status] - order[b.status];
        });
      return { cid, name: clientName.get(cid) ?? "Unknown", totalSent, clientReplyRate, clientBounceRate, rows };
    })
    // Divergence needs 2+ domains to have a meaningful "client average".
    .filter((g) => g.rows.length >= 2)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Burned-domain lifespan barometer.
  const burned = domainMetas.filter((d) => d.burnedAt && d.coldStartDate);
  const avgLifespan =
    burned.length > 0
      ? Math.round(
          burned.reduce((s, d) => s + daysBetween(d.coldStartDate!, d.burnedAt!), 0) / burned.length,
        )
      : null;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <a href="/admin" className="text-blue-600 underline">← Admin</a>
          <h1 className="text-xl font-bold mt-2">Deliverability — domain health</h1>
          <p className="text-gray-500">
            Last 14 days vs the prior 14 days. Reply/bounce from Smartlead; a domain needs 100+ recent
            sends to be judged. Yellow = reply −20% or bounce +30%; Red = reply −40% or bounce +40%.
          </p>
        </div>
        <form>
          <select name="client" defaultValue={clientFilter ?? ""} className="border p-2 rounded">
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="ml-2 bg-black text-white px-3 py-2 rounded">Filter</button>
        </form>
      </div>

      {apiError && (
        <div className="border border-red-300 bg-red-50 text-red-700 p-3 rounded">
          Couldn&apos;t reach Smartlead: {apiError}
        </div>
      )}

      {avgLifespan !== null && (
        <div className="border p-3 rounded bg-gray-50">
          <b>Domain lifespan barometer:</b> across {burned.length} domain(s) you&apos;ve marked burned,
          average cold-sending life was <b>{avgLifespan} days</b>.
        </div>
      )}

      <div className="overflow-x-auto border rounded">
        <table className="w-full">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-2">Domain</th>
              <th className="p-2">Status</th>
              <th className="p-2">Inboxes</th>
              <th className="p-2">Age</th>
              <th className="p-2">Recent (14d)</th>
              <th className="p-2">Prior (14d)</th>
              <th className="p-2">Cold-send</th>
              <th className="p-2">Client / notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ vm, inboxCount, age, coldAge, db }) => {
              const s = STATUS_STYLE[vm.status];
              return (
                <tr key={vm.domain} className="border-t align-top">
                  <td className="p-2 font-medium">
                    {vm.domain}
                    {db?.burnedAt && <span className="ml-1 text-red-600 text-xs">(burned)</span>}
                  </td>
                  <td className="p-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: s.bg, color: s.fg }}
                      title={vm.reason}
                    >
                      {s.label}
                    </span>
                    <div className="text-gray-400 text-xs mt-1">{vm.reason}</div>
                  </td>
                  <td className="p-2">{inboxCount ?? "—"}</td>
                  <td className="p-2">{age !== null ? `${age}d` : "—"}</td>
                  <td className="p-2 tabular-nums">
                    {vm.recentSent} sent<br />
                    <span className="text-green-700">{vm.recentReplyRate.toFixed(1)}% reply</span> ·{" "}
                    <span className="text-red-700">{vm.recentBounceRate.toFixed(1)}% bounce</span>
                  </td>
                  <td className="p-2 tabular-nums text-gray-500">
                    {vm.priorReplyRate.toFixed(1)}% reply<br />
                    {vm.priorBounceRate.toFixed(1)}% bounce
                  </td>
                  <td className="p-2">
                    {coldAge !== null ? `${coldAge}d` : <span className="text-gray-400">not set</span>}
                    <form action={toggleDomainBurned.bind(null, vm.domain)} className="mt-1">
                      <button className="underline text-xs text-red-600">
                        {db?.burnedAt ? "un-burn" : "mark burned"}
                      </button>
                    </form>
                  </td>
                  <td className="p-2">
                    <form action={updateDomainMeta.bind(null, vm.domain)} className="flex flex-col gap-1">
                      <select name="clientId" defaultValue={db?.clientId ?? ""} className="border p-1">
                        <option value="">— unassigned —</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        name="coldStartDate"
                        defaultValue={db?.coldStartDate ? db.coldStartDate.toISOString().slice(0, 10) : ""}
                        title="First real (non-warmup) send date"
                        className="border p-1"
                      />
                      <input name="note" defaultValue={db?.note ?? ""} placeholder="note" className="border p-1" />
                      <button className="underline text-xs">save</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !apiError && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500">
                  No domains with sending activity in the last 28 days
                  {clientFilter ? " for this client" : ""}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* View #2: domain divergence within each client */}
      <div>
        <h2 className="text-lg font-bold mt-8">Domain divergence within client</h2>
        <p className="text-gray-500 mb-3">
          Each domain&apos;s reply/bounce (last 14 days) vs its client&apos;s overall average. A domain
          far below the client&apos;s reply rate — or far above its bounce rate — while the client&apos;s
          other domains are fine is a strong &quot;this domain is hit&quot; signal (the copy is working;
          the inbox isn&apos;t). Needs {MIN_SENDS_FOR_SIGNAL}+ sends and 2+ assigned domains per client.
        </p>

        {divergenceGroups.length === 0 ? (
          <div className="border rounded p-4 text-gray-500">
            No clients with 2+ assigned, active domains yet. Assign domains to clients in the table
            above, then this analysis appears.
          </div>
        ) : (
          <div className="space-y-6">
            {divergenceGroups.map((g) => (
              <div key={g.cid} className="border rounded overflow-hidden">
                <div className="bg-gray-50 p-3 flex items-center justify-between">
                  <b>{g.name}</b>
                  <span className="text-gray-600 tabular-nums">
                    Client avg (14d): {g.clientReplyRate.toFixed(1)}% reply ·{" "}
                    {g.clientBounceRate.toFixed(1)}% bounce · {g.totalSent.toLocaleString("en-US")} sent
                  </span>
                </div>
                <table className="w-full">
                  <thead className="text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="p-2">Domain</th>
                      <th className="p-2">Sent</th>
                      <th className="p-2">Reply %</th>
                      <th className="p-2">Bounce %</th>
                      <th className="p-2">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => {
                      const s = DIVERGENCE_STYLE[r.status];
                      return (
                        <tr key={r.domain} className="border-t">
                          <td className="p-2 font-medium">{r.domain}</td>
                          <td className="p-2 tabular-nums">{r.sent}</td>
                          <td className="p-2 tabular-nums text-green-700">{r.replyRate.toFixed(1)}%</td>
                          <td className="p-2 tabular-nums text-red-700">{r.bounceRate.toFixed(1)}%</td>
                          <td className="p-2">
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{ background: s.bg, color: s.fg }}
                              title={r.reason}
                            >
                              {s.label}
                            </span>
                            <div className="text-gray-400 text-xs mt-1">{r.reason}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
