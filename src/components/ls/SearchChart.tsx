// Visits from Google as bars, times-appeared-in-search as a line over the
// top. Two scales, because impressions run ~100x clicks — plotted on one
// axis the visits would be a flat smear along the bottom.
//
// Plain SVG rather than a charting library: it's one shape, it has to render
// server-side with no hydration, and every library in this space weighs more
// than the page it would sit on. See D46.
export type SearchPoint = { month: string; label: string; clicks: number; impressions: number };

export function SearchChart({ points }: { points: SearchPoint[] }) {
  if (points.length < 2) return null;

  const W = 720;
  const H = 220;
  const PAD = { top: 22, right: 14, bottom: 30, left: 14 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxClicks = Math.max(1, ...points.map((p) => p.clicks));
  const maxImpr = Math.max(1, ...points.map((p) => p.impressions));

  const slot = plotW / points.length;
  const barW = Math.min(46, slot * 0.5);

  const x = (i: number) => PAD.left + slot * i + slot / 2;
  const yClicks = (v: number) => PAD.top + plotH - (v / maxClicks) * plotH;
  const yImpr = (v: number) => PAD.top + plotH - (v / maxImpr) * plotH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${yImpr(p.impressions)}`).join(" ");

  return (
    <div className="wa-searchchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Visits from Google each month, with how often you appeared in search">
        {points.map((p, i) => {
          const top = yClicks(p.clicks);
          return (
            <g key={p.month}>
              <rect
                x={x(i) - barW / 2}
                y={top}
                width={barW}
                height={PAD.top + plotH - top}
                rx="4"
                className="wa-sc-bar"
              />
              <text x={x(i)} y={top - 7} textAnchor="middle" className="wa-sc-barval">
                {p.clicks}
              </text>
              <text x={x(i)} y={H - 10} textAnchor="middle" className="wa-sc-label">
                {p.label}
              </text>
            </g>
          );
        })}

        <path d={line} className="wa-sc-line" fill="none" />
        {points.map((p, i) => (
          <circle key={p.month} cx={x(i)} cy={yImpr(p.impressions)} r="3.5" className="wa-sc-dot" />
        ))}
        {/* Only the ends are labelled — a number over every dot turns the
            line into noise, and the shape is the point. */}
        <text x={x(0)} y={yImpr(points[0].impressions) - 9} textAnchor="middle" className="wa-sc-imprval">
          {points[0].impressions.toLocaleString("en-US")}
        </text>
        <text
          x={x(points.length - 1)}
          y={yImpr(points[points.length - 1].impressions) - 9}
          textAnchor="middle"
          className="wa-sc-imprval"
        >
          {points[points.length - 1].impressions.toLocaleString("en-US")}
        </text>
      </svg>

      <div className="wa-sc-legend">
        <span>
          <i className="bar" /> Visits to your site
        </span>
        <span>
          <i className="line" /> Times you appeared in search
        </span>
      </div>
    </div>
  );
}
