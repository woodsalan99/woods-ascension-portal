"use client";

import { useState } from "react";

// One chart for everything that moves month to month, with each line
// switchable on and off.
//
// It replaced two charts that were actively misleading: total leads were
// printed underneath the AD VIEWS bars, which put free leads visually inside
// the ads story when the entire argument of the portal is that they're
// separate. Nothing sits under anything here — every series is a peer you
// can turn on or off. See D48.
//
// Two scales, quietly. Impressions run in the thousands and leads in single
// digits; on one axis the leads would be a flat line on the floor. Series
// declare which scale they belong to and the axis labels say which is which.
export type ChartSeries = {
  key: string;
  label: string;
  kind: "bar" | "line";
  scale: "people" | "views";
  color: string;
  values: (number | null)[];
};

const PAD = { top: 26, right: 54, bottom: 34, left: 46 };
const W = 760;
const H = 300;

export function PerformanceChart({
  months,
  series,
  defaultOn,
}: {
  months: string[];
  series: ChartSeries[];
  defaultOn: string[];
}) {
  const [on, setOn] = useState<Set<string>>(new Set(defaultOn));
  const [hover, setHover] = useState<number | null>(null);

  const visible = series.filter((s) => on.has(s.key));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, months.length);
  const x = (i: number) => PAD.left + slot * i + slot / 2;

  // Each scale is sized only by the series currently showing, so hiding the
  // big ones lets the small ones actually use the height.
  const maxFor = (scale: "people" | "views") => {
    const vals = visible.filter((s) => s.scale === scale).flatMap((s) => s.values.filter((v): v is number => v !== null));
    return Math.max(1, ...vals);
  };
  const maxPeople = maxFor("people");
  const maxViews = maxFor("views");
  const y = (v: number, scale: "people" | "views") =>
    PAD.top + plotH - (v / (scale === "people" ? maxPeople : maxViews)) * plotH;

  const bars = visible.filter((s) => s.kind === "bar");
  const lines = visible.filter((s) => s.kind === "line");
  const barW = Math.min(38, (slot * 0.55) / Math.max(1, bars.length));

  function toggle(key: string) {
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // Never let it empty out — a blank chart looks broken, not deselected.
      return next.size === 0 ? prev : next;
    });
  }

  const hasPeople = visible.some((s) => s.scale === "people");
  const hasViews = visible.some((s) => s.scale === "views");

  return (
    <div className="wa-perf">
      <div className="wa-perf-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Month by month performance"
          onMouseLeave={() => setHover(null)}
        >
          {/* Faint gridlines give the eye something to measure against. */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={PAD.top + plotH * f}
              y2={PAD.top + plotH * f}
              className="wa-perf-grid"
            />
          ))}

          {hasPeople &&
            [0, 0.5, 1].map((f) => (
              <text key={f} x={PAD.left - 9} y={PAD.top + plotH * f + 4} textAnchor="end" className="wa-perf-axis">
                {Math.round(maxPeople * (1 - f))}
              </text>
            ))}
          {hasViews &&
            [0, 0.5, 1].map((f) => (
              <text key={f} x={W - PAD.right + 9} y={PAD.top + plotH * f + 4} className="wa-perf-axis views">
                {Math.round(maxViews * (1 - f)).toLocaleString("en-US")}
              </text>
            ))}

          {/* Hover columns sit under everything and cover the full height, so
              the whole month is a target rather than each individual dot. */}
          {months.map((m, i) => (
            <rect
              key={m}
              x={PAD.left + slot * i}
              y={PAD.top}
              width={slot}
              height={plotH}
              className={`wa-perf-hit ${hover === i ? "on" : ""}`}
              onMouseEnter={() => setHover(i)}
            />
          ))}

          {bars.map((s, bi) =>
            s.values.map((v, i) =>
              v === null ? null : (
                <rect
                  key={`${s.key}-${i}`}
                  x={x(i) - (barW * bars.length) / 2 + bi * barW}
                  y={y(v, s.scale)}
                  width={barW - 2}
                  height={Math.max(0, PAD.top + plotH - y(v, s.scale))}
                  rx="3"
                  fill={s.color}
                  opacity={hover === null || hover === i ? 1 : 0.42}
                />
              ),
            ),
          )}

          {lines.map((s) => {
            const pts = s.values
              .map((v, i) => (v === null ? null : { i, v }))
              .filter((p): p is { i: number; v: number } => p !== null);
            if (pts.length === 0) return null;
            const d = pts.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i)},${y(p.v, s.scale)}`).join(" ");
            return (
              <g key={s.key}>
                <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p) => (
                  <circle
                    key={p.i}
                    cx={x(p.i)}
                    cy={y(p.v, p.i === hover ? s.scale : s.scale)}
                    r={hover === p.i ? 6 : 3.5}
                    fill={s.color}
                    stroke="#fff"
                    strokeWidth={hover === p.i ? 2.5 : 0}
                  />
                ))}
              </g>
            );
          })}

          {months.map((m, i) => (
            <text key={m} x={x(i)} y={H - 12} textAnchor="middle" className={`wa-perf-month ${hover === i ? "on" : ""}`}>
              {m}
            </text>
          ))}
        </svg>

        {/* Values live in the tooltip rather than printed on the chart. Every
            number drawn permanently is what made the old one collide with
            itself — "4,567" landing on top of "40". */}
        {hover !== null && (
          <div
            className="wa-perf-tip"
            style={{ left: `${((x(hover) - PAD.left) / plotW) * 100}%` }}
            data-side={hover > months.length / 2 ? "left" : "right"}
          >
            <div className="wa-perf-tip-month">{months[hover]}</div>
            {visible.map((s) => (
              <div key={s.key} className="wa-perf-tip-row">
                <i style={{ background: s.color }} />
                <span className="wa-perf-tip-label">{s.label}</span>
                <b>{s.values[hover] === null ? "—" : s.values[hover]!.toLocaleString("en-US")}</b>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="wa-perf-legend">
        {series.map((s) => {
          const active = on.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              className={`wa-perf-toggle ${active ? "on" : ""}`}
              aria-pressed={active}
              onClick={() => toggle(s.key)}
            >
              <i style={active ? { background: s.color } : undefined} className={s.kind} />
              {s.label}
            </button>
          );
        })}
      </div>
      <p className="wa-perf-hint">Tap any of those to show or hide it. Hover a month to see the numbers.</p>
    </div>
  );
}
