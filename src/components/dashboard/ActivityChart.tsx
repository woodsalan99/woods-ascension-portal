"use client";

import { useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type ChartDay = {
  d: string;
  sends: number;
  replies: number;
  bounces: number;
  appts: number;
  positiveReplyEmails: string[];
  isToday: boolean;
};

const fmt = (n: number) => n.toLocaleString("en-US");

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDay }>;
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div className="wa-tip">
      <div className="wa-tip-day">
        {label}
        {row.isToday && " · today"}
      </div>
      <div className="wa-tip-row">
        <span className="wa-dot" style={{ background: "#B9C4CE" }} />
        Sends <b>{fmt(row.sends)}</b>
      </div>
      <div className="wa-tip-row">
        <span className="wa-dot" style={{ background: "var(--green)" }} />
        Positive replies <b>{row.replies}</b>
      </div>
      <div className="wa-tip-row">
        <span className="wa-dot" style={{ background: "var(--brick)" }} />
        Bounces <b>{row.bounces}</b>
      </div>
      {row.appts > 0 && (
        <div className="wa-tip-row wa-tip-appt">
          <span className="wa-dot" style={{ background: "var(--gold)" }} />
          {row.appts} appointment{row.appts > 1 ? "s" : ""} booked
        </div>
      )}
      {row.positiveReplyEmails.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,.15)", fontSize: 11, opacity: 0.9 }}>
          <div style={{ marginBottom: 2, opacity: 0.7 }}>Positive replies counted:</div>
          {row.positiveReplyEmails.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}
      {row.isToday && (
        <div style={{ marginTop: 6, fontSize: 10.5, fontStyle: "italic", opacity: 0.7 }}>
          Today&apos;s data may be partial — updates hourly.
        </div>
      )}
    </div>
  );
}

function ApptDot(props: { cx?: number; cy?: number; payload?: ChartDay }) {
  const { cx, cy, payload } = props;
  if (!payload || !payload.appts || cx === undefined || cy === undefined) return null;
  return (
    <rect
      x={cx - 4.5}
      y={cy - 4.5}
      width="9"
      height="9"
      rx="1.5"
      transform={`rotate(45 ${cx} ${cy})`}
      fill="var(--gold)"
      stroke="#fff"
      strokeWidth="1.5"
    />
  );
}

export function ActivityChart({ data, bounceRate }: { data: ChartDay[]; bounceRate: number | null }) {
  const [show, setShow] = useState({ sends: true, replies: true, bounces: false });
  const toggle = (k: keyof typeof show) => setShow((s) => ({ ...s, [k]: !s[k] }));

  if (data.length === 0) {
    return (
      <div className="wa-card">
        <div className="wa-section-head">
          <div>
            <div className="wa-eyebrow">Daily activity</div>
            <h2 className="wa-h2">Sends, replies &amp; booked appointments</h2>
          </div>
        </div>
        <div className="wa-empty">
          <div className="wa-empty-mark">◇</div>
          <p>
            <b>Activity appears here once sending begins.</b>
          </p>
          <p>
            Daily sends, positive replies, and bounce trends will populate this chart hourly
            once campaigns are live and syncing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wa-card">
      <div className="wa-section-head">
        <div>
          <div className="wa-eyebrow">Daily activity</div>
          <h2 className="wa-h2">Sends, replies &amp; booked appointments</h2>
        </div>
        <div className="wa-chart-controls">
          <button className={`wa-chip ${show.sends ? "on" : ""}`} onClick={() => toggle("sends")}>
            <span className="wa-dot" style={{ background: "#B9C4CE" }} />
            Sends
          </button>
          <button className={`wa-chip ${show.replies ? "on" : ""}`} onClick={() => toggle("replies")}>
            <span className="wa-dot" style={{ background: "var(--green)" }} />
            Positive replies
          </button>
          <button className={`wa-chip ${show.bounces ? "on" : ""}`} onClick={() => toggle("bounces")}>
            <span className="wa-dot" style={{ background: "var(--brick)" }} />
            Bounces
          </button>
        </div>
      </div>

      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 12, right: 6, left: -14, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#EFEEE6" />
            <XAxis
              dataKey="d"
              tick={{ fontSize: 11, fill: "#77828F" }}
              tickLine={false}
              axisLine={{ stroke: "#E4E3DA" }}
              interval="preserveStartEnd"
            />
            <YAxis yAxisId="l" tick={{ fontSize: 11, fill: "#77828F" }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="r" orientation="right" hide domain={[0, 10]} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(16,30,46,.04)" }} />
            {show.sends && (
              <Bar yAxisId="l" dataKey="sends" fill="#C6CFD8" radius={[4, 4, 0, 0]} maxBarSize={26} />
            )}
            {show.bounces && (
              <Line yAxisId="r" dataKey="bounces" stroke="var(--brick)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
            )}
            {show.replies && (
              <Line yAxisId="r" dataKey="replies" stroke="var(--green)" strokeWidth={2.5} dot={false} />
            )}
            <Line
              yAxisId="r"
              dataKey={(row: ChartDay) => (row.appts > 0 ? row.appts + 6.8 : null)}
              stroke="transparent"
              dot={<ApptDot />}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="wa-chart-note">
        <span className="wa-gold-diamond" /> Gold markers are days an appointment was booked
        {bounceRate !== null && (
          <>
            {" "}
            · Bounce rate held at <b style={{ color: "var(--ink)" }}>&nbsp;{bounceRate.toFixed(1)}%</b>
          </>
        )}
      </div>
    </div>
  );
}
