import { requireClientType } from "@/lib/dashboard-scope";
import { prisma } from "@/lib/prisma";
import { getContent } from "@/lib/content";
import { formatMonthKey } from "@/lib/timezone";
import { EditProvider } from "@/components/ls/EditProvider";
import { E } from "@/components/ls/Editable";
import { Geogrid, type GeogridScanVM } from "@/components/ls/Geogrid";

type GridJson = { rows: number; cols: number; cells: number[] };

export default async function RankPage() {
  const scope = await requireClientType("LOCAL_SERVICES");
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: scope.clientId },
    select: { id: true },
  });
  const content = await getContent(client.id);

  const [scans, pages, reviews, integrations, gscRecent] = await Promise.all([
    prisma.geogridScan.findMany({ where: { clientId: client.id }, orderBy: [{ month: "desc" }, { keyword: "asc" }] }),
    prisma.sitePage.findMany({ where: { clientId: client.id }, orderBy: { town: "asc" } }),
    prisma.reviewSnapshot.findFirst({ where: { clientId: client.id }, orderBy: { date: "desc" } }),
    prisma.clientIntegration.findMany({ where: { clientId: client.id } }),
    prisma.gscDailyStat.findMany({
      where: { clientId: client.id, date: { gte: new Date(Date.now() - 28 * 86400000) } },
    }),
  ]);

  // Latest month's scans drive the map; every month feeds the trend strip.
  const latestMonth = scans[0]?.month ?? null;
  const latestScans: GeogridScanVM[] = scans
    .filter((s) => s.month === latestMonth)
    .map((s) => ({
      keyword: s.keyword,
      month: s.month,
      avgRank: s.avgRank,
      top3Pct: s.top3Pct,
      takenAt: s.takenAt,
      grid: s.gridJson as unknown as GridJson,
    }));

  // Month strip: one blended average per month, across every keyword and
  // location scanned that month (handoff §3.6).
  const byMonth = new Map<string, number[]>();
  for (const s of scans) {
    if (!byMonth.has(s.month)) byMonth.set(s.month, []);
    byMonth.get(s.month)!.push(s.avgRank);
  }
  const months = [...byMonth.entries()]
    .map(([month, avgs]) => ({ month, avg: avgs.reduce((a, b) => a + b, 0) / avgs.length }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const indexed = pages.filter((p) => p.indexed).length;
  const gscClicks = gscRecent.reduce((sum, d) => sum + d.clicks, 0);
  const gscImpressions = gscRecent.reduce((sum, d) => sum + d.impressions, 0);

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

      {months.length > 0 && (
        <div className="wa-card">
          <div className="wa-section-head">
            <div>
              <div className="wa-eyebrow">
                <E k="rank.monthStrip.label" v={content.text("rank.monthStrip.label")} label="Month strip label" />
              </div>
              <h2 className="wa-h2">
                <E k="rank.monthStrip.title" v={content.text("rank.monthStrip.title")} label="Month strip title" />
              </h2>
              <p className="wa-page-sub">
                <E k="rank.monthStrip.sub" v={content.text("rank.monthStrip.sub")} label="Month strip subtitle" multiline />
              </p>
            </div>
          </div>
          <div className="wa-month-strip">
            {months.map((m, i) => {
              const prev = i > 0 ? months[i - 1].avg : null;
              const better = prev !== null ? prev - m.avg : null;
              return (
                <div key={m.month} className={`wa-month-cell ${i === months.length - 1 ? "now" : ""}`}>
                  <div className="wa-month-name">{formatMonthKey(m.month).split(" ")[0]}</div>
                  <div className="wa-month-rank">{m.avg.toFixed(1)}</div>
                  <div className={`wa-month-delta ${better !== null && better > 0 ? "up" : ""}`}>
                    {better === null
                      ? "Starting point"
                      : better > 0
                        ? `↑ ${better.toFixed(1)} better`
                        : better < 0
                          ? `↓ ${Math.abs(better).toFixed(1)}`
                          : "No change"}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="wa-page-sub" style={{ marginTop: 16 }}>
            <E k="rank.monthStrip.footnote" v={content.text("rank.monthStrip.footnote")} label="Month strip footnote" multiline />
          </p>
        </div>
      )}

      <div className="wa-card">
        <div className="wa-section-head">
          <div>
            <div className="wa-eyebrow">
              <E k="rank.keywords.label" v={content.text("rank.keywords.label")} label="Keywords label" />
            </div>
            <h2 className="wa-h2">
              <E k="rank.keywords.title" v={content.text("rank.keywords.title")} label="Keywords title" />
            </h2>
            <p className="wa-page-sub">
              <E k="rank.keywords.sub" v={content.text("rank.keywords.sub")} label="Keywords subtitle" multiline />
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

      <div className="wa-card">
        <div className="wa-section-head">
          <div>
            <div className="wa-eyebrow">
              <E k="rank.factors.label" v={content.text("rank.factors.label")} label="Factors label" />
            </div>
            <h2 className="wa-h2">
              <E k="rank.factors.title" v={content.text("rank.factors.title")} label="Factors title" />
            </h2>
            <p className="wa-page-sub">
              <E k="rank.factors.sub" v={content.text("rank.factors.sub")} label="Factors subtitle" multiline />
            </p>
          </div>
        </div>
        <div className="wa-factor-grid">
          <div className="wa-factor">
            <div className="wa-factor-tag big">
              <E k="rank.factors.reviews.tag" v={content.text("rank.factors.reviews.tag")} label="Reviews tag" />
            </div>
            <h4><E k="rank.factors.reviews.title" v={content.text("rank.factors.reviews.title")} label="Reviews factor title" /></h4>
            <p><E k="rank.factors.reviews.body" v={content.text("rank.factors.reviews.body")} label="Reviews factor body" multiline /></p>
            <div className="wa-factor-you">
              {reviews ? (
                <>You have <b>{reviews.count} reviews at {reviews.rating.toFixed(1)}</b>. Every new one helps.</>
              ) : (
                <>We&apos;re still connecting your Google reviews — this will fill in shortly.</>
              )}
            </div>
          </div>

          <div className="wa-factor">
            <div className="wa-factor-tag big">
              <E k="rank.factors.photos.tag" v={content.text("rank.factors.photos.tag")} label="Photos tag" />
            </div>
            <h4><E k="rank.factors.photos.title" v={content.text("rank.factors.photos.title")} label="Photos factor title" /></h4>
            <p><E k="rank.factors.photos.body" v={content.text("rank.factors.photos.body")} label="Photos factor body" multiline /></p>
            <div className="wa-factor-you">
              <E k="rank.factors.photos.you" v={content.text("rank.factors.photos.you")} label="Photos factor — where you stand" multiline />
            </div>
          </div>

          <div className="wa-factor">
            <div className="wa-factor-tag mid">
              <E k="rank.factors.distance.tag" v={content.text("rank.factors.distance.tag")} label="Distance tag" />
            </div>
            <h4><E k="rank.factors.distance.title" v={content.text("rank.factors.distance.title")} label="Distance factor title" /></h4>
            <p><E k="rank.factors.distance.body" v={content.text("rank.factors.distance.body")} label="Distance factor body" multiline /></p>
            <div className="wa-factor-you">
              <E k="rank.factors.distance.you" v={content.text("rank.factors.distance.you")} label="Distance factor — where you stand" multiline />
            </div>
          </div>

          <div className="wa-factor">
            <div className="wa-factor-tag low">
              <E k="rank.factors.website.tag" v={content.text("rank.factors.website.tag")} label="Website tag" />
            </div>
            <h4><E k="rank.factors.website.title" v={content.text("rank.factors.website.title")} label="Website factor title" /></h4>
            <p><E k="rank.factors.website.body" v={content.text("rank.factors.website.body")} label="Website factor body" multiline /></p>
            <div className="wa-factor-you">
              <b>{pages.length} pages built</b>
              {indexed > 0 ? <>, <b>{indexed} showing on Google</b>.</> : <>. We&apos;ll confirm how many Google is showing once Search Console is connected.</>}
            </div>
          </div>
        </div>
      </div>

      <div className="wa-card">
        <div className="wa-section-head">
          <div>
            <div className="wa-eyebrow">
              <E k="rank.pages.label" v={content.text("rank.pages.label")} label="Pages label" />
            </div>
            <h2 className="wa-h2">
              <E k="rank.pages.title" v={content.text("rank.pages.title")} label="Pages title" />
            </h2>
            <p className="wa-page-sub">
              <E k="rank.pages.sub" v={content.text("rank.pages.sub")} label="Pages subtitle" multiline />
            </p>
          </div>
          {gscImpressions > 0 && (
            <span className="wa-weekbadge">
              {gscClicks.toLocaleString("en-US")} visits · {gscImpressions.toLocaleString("en-US")} times shown
            </span>
          )}
        </div>
        <div className="wa-ob-list">
          {pages.map((p) => (
            <div key={p.id} className="wa-ob-item">
              <div className="wa-ob-body">
                <div className="wa-ob-step">{p.town}</div>
              </div>
              <span className={`wa-pill ${p.indexed ? "live" : ""}`}>{p.indexed ? "On Google" : "Processing"}</span>
            </div>
          ))}
        </div>
      </div>

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
          <div className="wa-sys-head">
            <h3>Call tracking</h3>
            <span className={`wa-pill ${callrail.cls}`}>{callrail.label}</span>
          </div>
          <p>Every call is recorded and tagged with where it came from, so we know which of your listings is actually bringing in work.</p>
        </div>
        <div className="wa-sys-card">
          <div className="wa-sys-head">
            <h3>Robocall screening</h3>
            <span className={`wa-pill ${callrail.cls}`}>{callrail.label}</span>
          </div>
          <p>Callers press a number before they&apos;re put through. Robots can&apos;t press anything, so they never reach your phone.</p>
        </div>
        <div className="wa-sys-card">
          <div className="wa-sys-head">
            <h3>Website form filter</h3>
            <span className={`wa-pill ${gmail.cls}`}>{gmail.label}</span>
          </div>
          <p>Every message from your website gets checked first. Sales pitches and bot spam get dropped; real homeowners come straight through.</p>
        </div>
        <div className="wa-sys-card">
          <div className="wa-sys-head">
            <h3>Google Ads alerts</h3>
            <span className={`wa-pill ${gmail.cls}`}>{gmail.label}</span>
          </div>
          <p>Google&apos;s own notifications are unreliable, so we watch for new requests ourselves and put them straight onto your Leads page.</p>
        </div>
        <div className="wa-sys-card">
          <div className="wa-sys-head">
            <h3>Search Console</h3>
            <span className={`wa-pill ${gsc.cls}`}>{gsc.label}</span>
          </div>
          <p>Tracks which of your pages Google is actually showing, and how often people see and click them.</p>
        </div>
        <div className="wa-sys-card">
          <div className="wa-sys-head">
            <h3>Review tracking</h3>
            <span className={`wa-pill ${places.cls}`}>{places.label}</span>
          </div>
          <p>Watches your Google review count and rating so we can see the effect of every review request.</p>
        </div>
      </div>
    </EditProvider>
  );
}
