import { requireClientType } from "@/lib/dashboard-scope";
import { prisma } from "@/lib/prisma";
import { getContent } from "@/lib/content";
import { resolveMetrics } from "@/lib/ls-metrics";
import { formatMonthKey, monthKeyInTimezone } from "@/lib/timezone";
import { EditProvider } from "@/components/ls/EditProvider";
import { E } from "@/components/ls/Editable";
import { Num } from "@/components/ls/Num";
import { Geogrid, type GeogridScanVM } from "@/components/ls/Geogrid";
import { ControlsPanel } from "@/components/ls/ControlsPanel";

// The page is organised around the three places a homeowner can actually
// find Canencia — Maps, the website, the ads — because that's how a painter
// thinks about it. It used to be organised around which tool reported what,
// which meant the website half was a black box: a single "34 visits" badge
// tucked beside a list of page names. See D42.
type GridJson = { rows: number; cols: number; cells: number[]; radiusMiles?: number };

export default async function RankPage() {
  const scope = await requireClientType("LOCAL_SERVICES");
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: scope.clientId },
    select: { id: true, timezone: true },
  });
  const content = await getContent(client.id);
  const month = monthKeyInTimezone(new Date(), client.timezone);

  const [scans, pages, integrations, gscDaily, keywords] = await Promise.all([
    prisma.geogridScan.findMany({ where: { clientId: client.id }, orderBy: [{ month: "desc" }, { keyword: "asc" }] }),
    prisma.sitePage.findMany({ where: { clientId: client.id }, orderBy: { town: "asc" } }),
    prisma.clientIntegration.findMany({ where: { clientId: client.id } }),
    prisma.gscDailyStat.findMany({ where: { clientId: client.id }, orderBy: { date: "asc" } }),
    prisma.keywordRank.findMany({
      where: { clientId: client.id },
      orderBy: [{ month: "desc" }, { position: "asc" }],
    }),
  ]);

  const latestMonth = scans[0]?.month ?? null;
  const latestScans: GeogridScanVM[] = scans
    .filter((s) => s.month === latestMonth)
    .map((s) => ({
      id: s.id,
      keyword: s.keyword,
      month: s.month,
      avgRank: s.avgRank,
      top3Pct: s.top3Pct,
      takenAt: s.takenAt,
      grid: s.gridJson as unknown as GridJson,
      hasMapImage: s.mapImage !== null,
    }));

  // ---- Website: the black box, opened ----
  // Roll the daily rows up by month so the client sees a shape, not a number.
  const byMonth = new Map<string, { clicks: number; impressions: number }>();
  for (const d of gscDaily) {
    const key = `${d.date.getUTCFullYear()}-${String(d.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const row = byMonth.get(key) ?? { clicks: 0, impressions: 0 };
    row.clicks += d.clicks;
    row.impressions += d.impressions;
    byMonth.set(key, row);
  }
  // The current month is partial, so including it would always read as a
  // collapse. Show the last six complete months.
  const webMonths = [...byMonth.entries()]
    .filter(([m]) => m !== month)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([m, v]) => ({ month: m, ...v }));
  const maxClicks = Math.max(1, ...webMonths.map((m) => m.clicks));
  const lastFull = webMonths[webMonths.length - 1];

  const indexed = pages.filter((p) => p.indexed).length;
  const latestKeywordMonth = keywords[0]?.month ?? null;
  const latestKeywords = keywords.filter((k) => k.month === latestKeywordMonth);

  // ---- Ads: moved here from The Numbers, where they sat beside lead and
  // job counts they have nothing to do with. ----
  const adKeys = [
    `lsa.impressions:${month}`,
    "lsa.impressions.trend",
    `lsa.topRate:${month}`,
    `lsa.topRate.support:${month}`,
    `lsa.chargedLeads:${month}`,
    "lsa.chargedLeads.trend",
    `lsa.cpl:${month}`,
    `lsa.cpl.support:${month}`,
    `lsa.spend:${month}`,
  ];
  const adMetrics = await resolveMetrics(client.id, client.timezone, adKeys);
  const ad = (k: string) => adMetrics.get(k)!;

  const statusOf = (provider: string) => {
    const i = integrations.find((x) => x.provider === provider);
    if (!i) return { cls: "", label: "Not connected yet" };
    if (i.status === "ACTIVE") return { cls: "live", label: "● Working" };
    return { cls: "wait", label: "● Needs attention" };
  };
  const callrail = statusOf("CALLRAIL");
  const gmail = statusOf("GMAIL");
  const gsc = statusOf("GSC");
  const places = statusOf("GOOGLE_PLACES");

  const AssetHead = ({ titleKey, label }: { titleKey: "rank.asset.maps.title" | "rank.asset.web.title" | "rank.asset.ads.title"; label: string }) => (
    <div className="wa-asset-head wa-asset-head-centered">
      <h2 className="wa-asset-title">
        <E k={titleKey} v={content.text(titleKey)} label={label} />
      </h2>
      <p className="wa-asset-sub">
        <E k="rank.asset.subtitle" v={content.text("rank.asset.subtitle")} label="Asset subtitle" />
      </p>
    </div>
  );

  return (
    <EditProvider clientId={client.id} canEdit={scope.isPreview}>
      <div className="wa-page-head">
        <div>
          <div className="wa-eyebrow">
            <E k="rank.eyebrow" v={content.text("rank.eyebrow")} label="Rank eyebrow" />
          </div>
          <h1 className="wa-page-title">
            <E k="rank.title" v={content.text("rank.title")} label="Rank title" />
          </h1>
          <div className="wa-page-sub">
            <E k="rank.sub" v={content.text("rank.sub")} label="Rank subtitle" multiline />
          </div>
        </div>
        {latestScans[0] && (
          <span className="wa-weekbadge">
            Checked {latestScans[0].takenAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          </span>
        )}
      </div>


      {/* ---------- The three core pieces ---------- */}
      <div className="wa-core">
        <div className="wa-core-label">
          <E k="rank.core.label" v={content.text("rank.core.label")} label="Core pieces label" />
        </div>
        <div className="wa-core-grid">
          {(
            [
              ["rank.core.1", "rank.core.1.note"],
              ["rank.core.2", "rank.core.2.note"],
              ["rank.core.3", "rank.core.3.note"],
            ] as const
          ).map(([nameKey, noteKey], i) => (
            <div key={nameKey} className="wa-core-piece">
              <span className="wa-core-num">{i + 1}</span>
              <div>
                <b>
                  <E k={nameKey} v={content.text(nameKey)} label={`Core piece ${i + 1}`} />
                </b>
                <span>
                  <E k={noteKey} v={content.text(noteKey)} label={`Core piece ${i + 1} note`} />
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="wa-core-sub">
          <E k="rank.core.sub" v={content.text("rank.core.sub")} label="Core pieces subtitle" multiline />
        </p>
      </div>

      {/* ---------- Asset 1: Google Maps ---------- */}
      <AssetHead titleKey="rank.asset.maps.title" label="Asset 1 title" />
      {latestScans.length > 0 && (
        <div className="wa-note-strip">
          <b>
            <E k="rank.howToRead.title" v={content.text("rank.howToRead.title")} label="How to read — heading" />
          </b>{" "}
          <E k="rank.howToRead.body" v={content.text("rank.howToRead.body")} label="How to read — body" multiline />
          <br />
          <br />
          <b>
            <E k="rank.whyVaries.title" v={content.text("rank.whyVaries.title")} label="Why it varies — heading" />
          </b>{" "}
          <E k="rank.whyVaries.body" v={content.text("rank.whyVaries.body")} label="Why it varies — body" multiline />
        </div>
      )}
      <div className="wa-card wa-card-centered">
        <div className="wa-section-head wa-section-head-centered">
          <div>
            <h2 className="wa-h2">
              <E k="rank.keywords.title" v={content.text("rank.keywords.title")} label="Keywords title" />
            </h2>
            <p className="wa-page-sub">
              <E k="rank.keywords.sub" v={content.text("rank.keywords.sub")} label="Keywords subtitle" multiline />
            </p>
            <p className="wa-page-sub wa-page-sub-quiet">
              <E k="rank.keywords.note" v={content.text("rank.keywords.note")} label="Keywords note" multiline />
            </p>
          </div>
        </div>
        {latestScans.length === 0 ? (
          <div className="wa-empty wa-empty-slim">
            <p>
              <E k="rank.geo.empty" v={content.text("rank.geo.empty")} label="Map empty state" />
            </p>
          </div>
        ) : (
          <Geogrid scans={latestScans} />
        )}
      </div>
      <ControlsPanel
        contentKey="rank.controls.maps.items"
        items={content.list("rank.controls.maps.items")}
        title={content.text("rank.controls.maps.title")}
      />

      {/* ---------- Asset 2: Website ---------- */}
      <AssetHead titleKey="rank.asset.web.title" label="Asset 2 title" />
      <div className="wa-card">
        <p className="wa-page-sub" style={{ marginTop: 0 }}>
          <E k="rank.web.sub" v={content.text("rank.web.sub")} label="Website subtitle" multiline />
        </p>

        <div className="wa-recap-grid" style={{ marginTop: 20 }}>
          <div className="wa-recap-cell">
            <div className="wa-kpi-label">
              <E k="rank.web.visits.label" v={content.text("rank.web.visits.label")} label="Web visits label" />
            </div>
            <div className="wa-recap-v">{lastFull ? lastFull.clicks.toLocaleString("en-US") : "—"}</div>
            {lastFull && <div className="wa-number-support">in {formatMonthKey(lastFull.month)}</div>}
          </div>
          <div className="wa-recap-cell">
            <div className="wa-kpi-label">
              <E k="rank.web.impressions.label" v={content.text("rank.web.impressions.label")} label="Web impressions label" />
            </div>
            <div className="wa-recap-v">{lastFull ? lastFull.impressions.toLocaleString("en-US") : "—"}</div>
            {lastFull && <div className="wa-number-support">in {formatMonthKey(lastFull.month)}</div>}
          </div>
          <div className="wa-recap-cell">
            <div className="wa-kpi-label">
              <E k="rank.web.pages.label" v={content.text("rank.web.pages.label")} label="Web pages label" />
            </div>
            <div className="wa-recap-v">
              {indexed} of {pages.length}
            </div>
            <div className="wa-number-support">
              {pages.length - indexed === 0 ? "All of them" : `${pages.length - indexed} still processing`}
            </div>
          </div>
        </div>

        {webMonths.length > 1 && (
          <>
            <h3 className="wa-recap-h3" style={{ marginTop: 26 }}>
              <E k="rank.web.trend.title" v={content.text("rank.web.trend.title")} label="Website trend title" />
            </h3>
            <div className="wa-bars">
              {webMonths.map((m) => (
                <div key={m.month} className="wa-bar-group">
                  <div className="wa-bar-stack">
                    <div className="wa-bar" style={{ height: `${(m.clicks / maxClicks) * 100}%` }}>
                      <span className="wa-bar-val">{m.clicks}</span>
                    </div>
                  </div>
                  <span className="wa-bar-label">{formatMonthKey(m.month).split(" ")[0]}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <h3 className="wa-recap-h3" style={{ marginTop: 26 }}>
          <E k="rank.web.keywords.title" v={content.text("rank.web.keywords.title")} label="Website keywords title" />
        </h3>
        <p className="wa-page-sub" style={{ marginBottom: 12 }}>
          <E k="rank.web.keywords.sub" v={content.text("rank.web.keywords.sub")} label="Website keywords subtitle" multiline />
        </p>
        {latestKeywords.length === 0 ? (
          <div className="wa-empty wa-empty-slim">
            <p>
              <E k="rank.web.keywords.empty" v={content.text("rank.web.keywords.empty")} label="Keywords empty state" />
            </p>
          </div>
        ) : (
          <div className="wa-kwrank-list">
            {latestKeywords.map((k) => {
              const moved = k.prevPosition !== null ? k.prevPosition - k.position : null;
              return (
                <div key={k.id} className="wa-kwrank">
                  <span className={`wa-kwrank-pos ${k.position <= 3 ? "top" : k.position <= 10 ? "mid" : ""}`}>
                    {k.position}
                  </span>
                  <div className="wa-kwrank-main">
                    <b>{k.keyword}</b>
                    <span>
                      {k.volume ? `about ${k.volume.toLocaleString("en-US")} searches a month` : "search volume not reported"}
                    </span>
                  </div>
                  {moved !== null && moved !== 0 && (
                    <span className={`wa-kwrank-move ${moved > 0 ? "up" : "down"}`}>
                      {moved > 0 ? `↑ ${moved}` : `↓ ${Math.abs(moved)}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <h3 className="wa-recap-h3" style={{ marginTop: 26 }}>
          <E k="rank.web.pages.title" v={content.text("rank.web.pages.title")} label="Pages title" />
        </h3>
        <p className="wa-page-sub" style={{ marginBottom: 10 }}>
          <E k="rank.pages.sub" v={content.text("rank.pages.sub")} label="Pages subtitle" multiline />
        </p>
        <div className="wa-ob-list">
          {pages.map((p) => (
            <a
              key={p.id}
              className="wa-ob-item wa-ob-item-link"
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="wa-ob-body">
                <div className="wa-ob-step">{p.town}</div>
              </div>
              <span className={`wa-pill ${p.indexed ? "live" : ""}`}>
                {p.indexed ? "On Google →" : "Processing →"}
              </span>
            </a>
          ))}
        </div>
      </div>
      <ControlsPanel
        contentKey="rank.controls.web.items"
        items={content.list("rank.controls.web.items")}
        title={content.text("rank.controls.web.title")}
      />

      {/* ---------- Asset 3: Google Ads ---------- */}
      <AssetHead titleKey="rank.asset.ads.title" label="Asset 3 title" />
      <div className="wa-card">
        <p className="wa-page-sub" style={{ marginTop: 0 }}>
          <E k="rank.ads.sub" v={content.text("rank.ads.sub")} label="Ads subtitle" multiline />
        </p>
        <div className="wa-recap-grid" style={{ marginTop: 20 }}>
          <div className="wa-recap-cell">
            <div className="wa-kpi-label">
              <E k="numbers.impressions.label" v={content.text("numbers.impressions.label")} label="Impressions label" />
            </div>
            <div className="wa-recap-v">
              <Num m={ad(`lsa.impressions:${month}`)} clientId={client.id} label="Ad impressions" />
            </div>
            <div className="wa-number-support">
              <Num m={ad("lsa.impressions.trend")} clientId={client.id} label="Impressions trend" />
            </div>
          </div>
          <div className="wa-recap-cell">
            <div className="wa-kpi-label">
              <E k="numbers.topRate.label" v={content.text("numbers.topRate.label")} label="Top rate label" />
            </div>
            <div className="wa-recap-v">
              <Num m={ad(`lsa.topRate:${month}`)} clientId={client.id} label="Shown-first rate" />
            </div>
            <div className="wa-number-support">
              <Num m={ad(`lsa.topRate.support:${month}`)} clientId={client.id} label="Shown-first previous month" />
            </div>
          </div>
          <div className="wa-recap-cell">
            <div className="wa-kpi-label">
              <E k="numbers.adLeads.label" v={content.text("numbers.adLeads.label")} label="Ad leads label" />
            </div>
            <div className="wa-recap-v">
              <Num m={ad(`lsa.chargedLeads:${month}`)} clientId={client.id} label="Charged ad leads" />
            </div>
            <div className="wa-number-support">
              <Num m={ad("lsa.chargedLeads.trend")} clientId={client.id} label="Ad leads trend" />
            </div>
          </div>
          <div className="wa-recap-cell">
            <div className="wa-kpi-label">
              <E k="numbers.cpl.label" v={content.text("numbers.cpl.label")} label="Cost per lead label" />
            </div>
            <div className="wa-recap-v">
              <Num m={ad(`lsa.cpl:${month}`)} clientId={client.id} label="Cost per ad lead" />
            </div>
            <div className="wa-number-support">
              <Num m={ad(`lsa.cpl.support:${month}`)} clientId={client.id} label="Cost per lead detail" />
            </div>
          </div>
          <div className="wa-recap-cell">
            <div className="wa-kpi-label">
              <E k="numbers.spend.label" v={content.text("numbers.spend.label")} label="Spend label" />
            </div>
            <div className="wa-recap-v">
              <Num m={ad(`lsa.spend:${month}`)} clientId={client.id} label="Ad spend" />
            </div>
          </div>
        </div>
        <p className="wa-page-sub" style={{ marginTop: 16 }}>
          <E k="numbers.impressions.healthy" v={content.text("numbers.impressions.healthy")} label="Impressions healthy range" multiline />
        </p>
      </div>
      <ControlsPanel
        contentKey="rank.controls.ads.items"
        items={content.list("rank.controls.ads.items")}
        title={content.text("rank.controls.ads.title")}
      />

      {/* ---------- Behind the scenes ---------- */}
      <div className="wa-section-head">
        <h2 className="wa-h2">
          <E k="rank.systems.title" v={content.text("rank.systems.title")} label="Systems title" />
        </h2>
        <span className="wa-page-sub">
          <E k="rank.systems.sub" v={content.text("rank.systems.sub")} label="Systems subtitle" />
        </span>
      </div>
      <div className="wa-sys-grid">
        <div className="wa-sys-card">
          <h3>Call tracking</h3>
          <p>Every call to your tracking number is logged and screened for robocalls.</p>
          <span className={`wa-pill ${callrail.cls}`}>{callrail.label}</span>
        </div>
        <div className="wa-sys-card">
          <h3>Website enquiries</h3>
          <p>Form submissions are read, checked for junk, and turned into leads.</p>
          <span className={`wa-pill ${gmail.cls}`}>{gmail.label}</span>
        </div>
        <div className="wa-sys-card">
          <h3>Search Console</h3>
          <p>Tracks which of your pages Google is showing, and how often.</p>
          <span className={`wa-pill ${gsc.cls}`}>{gsc.label}</span>
        </div>
        <div className="wa-sys-card">
          <h3>Google reviews</h3>
          <p>Your review count and rating, checked daily.</p>
          <span className={`wa-pill ${places.cls}`}>{places.label}</span>
        </div>
      </div>
    </EditProvider>
  );
}
