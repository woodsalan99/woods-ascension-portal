"use client";

import { useState } from "react";

export type GeogridScanVM = {
  id: string;
  keyword: string;
  month: string;
  avgRank: number;
  top3Pct: number;
  takenAt: Date;
  grid: { rows: number; cols: number; cells: number[]; radiusMiles?: number };
  /** True when a real Local Falcon map export is stored for this scan. */
  hasMapImage: boolean;
};

// Rank bands ported from the approved mock's rankClass(). 20 means "20+"
// in Local Falcon — i.e. not realistically visible.
function rankClass(n: number): string {
  if (n <= 1) return "r1";
  if (n <= 2) return "r2";
  if (n <= 3) return "r3";
  if (n <= 4) return "r4";
  if (n <= 6) return "r5";
  if (n <= 8) return "r6";
  if (n <= 11) return "r7";
  if (n <= 14) return "r8";
  return "rx";
}

export function Geogrid({ scans }: { scans: GeogridScanVM[] }) {
  const [active, setActive] = useState(0);
  if (scans.length === 0) return null;

  const scan = scans[Math.min(active, scans.length - 1)];
  const { rows, cols, cells } = scan.grid;

  return (
    <>
      {scans.length > 1 && (
        <div className="wa-kw-tabs">
          {scans.map((s, i) => (
            <button
              key={s.keyword}
              className={`wa-kw-tab ${i === active ? "active" : ""}`}
              onClick={() => setActive(i)}
            >
              &ldquo;{s.keyword}&rdquo;
            </button>
          ))}
        </div>
      )}

      <div className="wa-geo-wrap">
        <div className="wa-geo-frame">
          {scan.hasMapImage ? (
            // The real Local Falcon export, with actual island geography
            // behind the pins — far more meaningful than a bare grid, since
            // it shows WHERE each position was measured.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="wa-geo-map"
              src={`/api/geogrid/${scan.id}/image`}
              alt={`Map showing your Google position for "${scan.keyword}" at ${cells.length} points across the island`}
            />
          ) : (
            <div
              className="wa-geogrid"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
              role="img"
              aria-label={`Your ranking for "${scan.keyword}" across ${rows * cols} spots on the island`}
            >
              {cells.map((n, i) => (
                <div key={i} className={`wa-geo-cell ${rankClass(n)}`} title={`Position ${n >= 20 ? "20+" : n}`}>
                  {n >= 20 ? "20+" : n}
                </div>
              ))}
            </div>
          )}
          <div className="wa-geo-legend">
            <span><i className="r1" />1–3 · top of the map</span>
            <span><i className="r4" />4–6</span>
            <span><i className="r7" />7–14</span>
            <span><i className="rx" />15+ · not really visible</span>
          </div>
        </div>

        <div>
          <div className="wa-geo-stat">
            <div className="wa-kpi-label">Average position</div>
            <div className="wa-geo-stat-value">{scan.avgRank.toFixed(1)}</div>
            <div className="wa-geo-stat-delta">
              across all {cells.length} spots{scan.grid.radiusMiles ? ` within ${scan.grid.radiusMiles} miles` : ""}
            </div>
          </div>
          <div className="wa-geo-stat">
            <div className="wa-kpi-label">Spots where you&apos;re top 3</div>
            <div className="wa-geo-stat-value">{Math.round(scan.top3Pct)}%</div>
            <div className="wa-geo-stat-delta">
              {cells.filter((c) => c <= 3).length} of {cells.length} spots
            </div>
          </div>
          <div className="wa-geo-stat">
            <div className="wa-kpi-label">Checked</div>
            <div className="wa-geo-stat-value" style={{ fontSize: 18 }}>
              {scan.takenAt.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            </div>
            <div className="wa-geo-stat-delta">We check again next month</div>
          </div>
        </div>
      </div>
    </>
  );
}
