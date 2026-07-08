import React, { useState, useEffect, useRef } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

/* ================= DATA ================= */

const W6_DAILY = [
  { d: "Jun 15", sends: 180, replies: 1, bounces: 4, appts: 0 },
  { d: "Jun 16", sends: 220, replies: 1, bounces: 5, appts: 0 },
  { d: "Jun 17", sends: 260, replies: 2, bounces: 5, appts: 1 },
  { d: "Jun 18", sends: 300, replies: 1, bounces: 6, appts: 0 },
  { d: "Jun 19", sends: 340, replies: 3, bounces: 7, appts: 0 },
  { d: "Jun 22", sends: 420, replies: 3, bounces: 8, appts: 1 },
  { d: "Jun 23", sends: 460, replies: 4, bounces: 9, appts: 0 },
  { d: "Jun 24", sends: 500, replies: 3, bounces: 9, appts: 1 },
  { d: "Jun 25", sends: 560, replies: 5, bounces: 10, appts: 1 },
  { d: "Jun 26", sends: 600, replies: 4, bounces: 11, appts: 0 },
  { d: "Jun 29", sends: 660, replies: 6, bounces: 11, appts: 1 },
  { d: "Jun 30", sends: 700, replies: 5, bounces: 12, appts: 2 },
  { d: "Jul 1", sends: 740, replies: 6, bounces: 13, appts: 1 },
  { d: "Jul 2", sends: 800, replies: 7, bounces: 13, appts: 1 },
  { d: "Jul 3", sends: 820, replies: 6, bounces: 14, appts: 0 },
  { d: "Jul 6", sends: 860, replies: 8, bounces: 15, appts: 2 },
  { d: "Jul 7", sends: 900, replies: 7, bounces: 15, appts: 1 },
  { d: "Jul 8", sends: 640, replies: 5, bounces: 10, appts: 1 },
];

const W1_DAILY = [
  { d: "Day 1", sends: 12, replies: 0, bounces: 0, appts: 0 },
  { d: "Day 2", sends: 18, replies: 0, bounces: 0, appts: 0 },
  { d: "Day 3", sends: 24, replies: 0, bounces: 1, appts: 0 },
  { d: "Day 4", sends: 30, replies: 0, bounces: 0, appts: 0 },
  { d: "Day 5", sends: 36, replies: 0, bounces: 1, appts: 0 },
  { d: "Day 6", sends: 40, replies: 0, bounces: 0, appts: 0 },
  { d: "Day 7", sends: 48, replies: 0, bounces: 1, appts: 0 },
  { d: "Day 8", sends: 54, replies: 0, bounces: 0, appts: 0 },
];

const W6_MILESTONES = [
  { label: "Campaign launch", sub: "Day 21", state: "done" },
  { label: "First positive reply", sub: "Day 21", state: "done" },
  { label: "First call booked", sub: "Day 23", state: "done" },
  { label: "5 calls booked", sub: "Day 31", state: "done" },
  { label: "First deal closed", sub: "Day 37", state: "done" },
  { label: "15 calls booked", sub: "13 of 15", state: "current", progress: 13 / 15 },
  { label: "25 calls booked", sub: "Next target", state: "next" },
];

const W1_MILESTONES = [
  { label: "Kickoff", sub: "Day 0", state: "done" },
  { label: "Infrastructure live", sub: "Day 1", state: "done" },
  { label: "Targeting & strategy", sub: "Days 1–4", state: "current", progress: 0.6 },
  { label: "Strategy review call", sub: "Days 7–10", state: "next" },
  { label: "Campaign launch", sub: "Day 21", state: "next" },
  { label: "First positive reply", sub: "Weeks 4–5", state: "next" },
  { label: "First call booked", sub: "Weeks 4–6", state: "next" },
];

const ONBOARDING = [
  { step: "Define qualified appointment criteria together", day: "Day 0" },
  { step: "Sign contract & settle first invoice", day: "Day 0" },
  { step: "Complete intake form — targets, company details, offer", day: "Days 1–3", cta: "Open intake form" },
  { step: "Domains & inboxes provisioned, warmup started", day: "Day 1" },
  { step: "Initial campaign strategy mapped", day: "Days 1–4" },
  { step: "Strategy review call + calendar integration", day: "Days 7–10", cta: "Book the call" },
  { step: "Campaign launch", day: "Day 21" },
];

const W1_ONBOARDING_STATE = ["done", "done", "current", "active", "active", "next", "next"];

const PIPELINE_W6 = [
  {
    stage: "Positive Reply", count: 77, note: "In conversation or nurturing",
    leads: [
      { name: "K. Morrison", co: "Morrison Hauling", val: "Qualifying" },
      { name: "P. Nguyen", co: "Nguyen Auto Group", val: "Qualifying" },
    ],
  },
  {
    stage: "Call Booked", count: 13, note: "$685K est. pipeline",
    leads: [
      { name: "Marcus Reyes", co: "Reyes Logistics", val: "$140K" },
      { name: "Dana Whitfield", co: "Whitfield Dental", val: "$85K" },
    ],
  },
  {
    stage: "Call Held", count: 9, note: "In follow-up",
    leads: [
      { name: "Tom Okafor", co: "Okafor Construction", val: "$220K" },
      { name: "Lisa Tran", co: "Tran Freight Co.", val: "$95K" },
    ],
  },
  {
    stage: "Closed", count: 3, note: "Funded",
    leads: [
      { name: "J. Alvarez", co: "Alvarez Towing", val: "$60K" },
      { name: "R. Castillo", co: "Castillo Paving", val: "$110K" },
    ],
  },
];

const CALLS_W6 = [
  { when: "Thu, Jul 9 · 3:00 PM EST", name: "Marcus Reyes", co: "Reyes Logistics", topic: "Fleet expansion · $140K", status: "Confirmed" },
  { when: "Fri, Jul 10 · 11:30 AM EST", name: "Dana Whitfield", co: "Whitfield Dental", topic: "Equipment financing · $85K", status: "Confirmed" },
  { when: "Mon, Jul 13 · 2:00 PM EST", name: "Sam Bhatt", co: "Bhatt Courier Group", topic: "Vehicle line · $110K", status: "Pending" },
];

/* ================= HELPERS ================= */

function useCountUp(target, duration = 900, deps = []) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setVal(target); return; }
    let raf; const start = performance.now();
    const tick = (t) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, deps.concat([target]));
  return val;
}

const fmt = (n) => n.toLocaleString("en-US");

/* ================= SMALL PIECES ================= */

const Check = ({ size = 11, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
    <path d="M2 6.5L4.8 9.2 10 3.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Play = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
    <path d="M6 4.5v11l9-5.5-9-5.5z" fill="#101E2E" />
  </svg>
);

function KPI({ label, value, prefix = "", suffix = "", detail, deps, accent }) {
  const isNumeric = typeof value === "number";
  const counted = useCountUp(isNumeric ? value : 0, 900, deps);
  return (
    <div className="wa-kpi">
      <div className="wa-kpi-label">{label}</div>
      <div className="wa-kpi-value" style={accent ? { color: "var(--green)" } : undefined}>
        {prefix}{isNumeric ? fmt(counted) : value}{suffix}
      </div>
      {detail && <div className="wa-kpi-detail">{detail}</div>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div className="wa-tip">
      <div className="wa-tip-day">{label}</div>
      <div className="wa-tip-row"><span className="wa-dot" style={{ background: "#B9C4CE" }} />Sends <b>{fmt(row.sends)}</b></div>
      <div className="wa-tip-row"><span className="wa-dot" style={{ background: "var(--green)" }} />Positive replies <b>{row.replies}</b></div>
      <div className="wa-tip-row"><span className="wa-dot" style={{ background: "var(--brick)" }} />Bounces <b>{row.bounces}</b></div>
      {row.appts > 0 && (
        <div className="wa-tip-row wa-tip-appt">
          <span className="wa-dot" style={{ background: "var(--gold)" }} />
          {row.appts} call{row.appts > 1 ? "s" : ""} booked
        </div>
      )}
    </div>
  );
}

const ApptDot = (props) => {
  const { cx, cy, payload } = props;
  if (!payload || !payload.appts) return null;
  return (
    <g>
      <rect x={cx - 4.5} y={cy - 4.5} width="9" height="9" rx="1.5"
        transform={`rotate(45 ${cx} ${cy})`} fill="var(--gold)" stroke="#fff" strokeWidth="1.5" />
    </g>
  );
};

/* ================= SECTIONS ================= */

function Journey({ milestones }) {
  const doneCount = milestones.filter((m) => m.state === "done").length;
  const currentIdx = milestones.findIndex((m) => m.state === "current");
  const current = milestones[currentIdx];
  const railPct = ((doneCount + (current?.progress || 0)) / (milestones.length - 1)) * 100;

  return (
    <div className="wa-card">
      <div className="wa-section-head">
        <div>
          <div className="wa-eyebrow">Campaign journey</div>
          <h2 className="wa-h2">Where we are, and what's next</h2>
        </div>
        {current && (
          <div className="wa-focus-chip">
            <span className="wa-pulse" />
            Current focus: <b>{current.label}</b>
          </div>
        )}
      </div>

      <div className="wa-rail-wrap">
        <div className="wa-rail-line" />
        <div className="wa-rail-fill" style={{ width: `${Math.min(railPct, 100)}%` }} />
        <div className="wa-rail-nodes">
          {milestones.map((m, i) => (
            <div key={i} className={`wa-node wa-node-${m.state}`}>
              <div className="wa-node-dot">
                {m.state === "done" && <Check />}
                {m.state === "current" && <span className="wa-node-ring" />}
              </div>
              <div className="wa-node-label">{m.label}</div>
              <div className="wa-node-sub">{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {current && current.progress !== undefined && (
        <div className="wa-progress-block">
          <div className="wa-progress-meta">
            <span>Progress to next milestone</span>
            <b>{Math.round(current.progress * 100)}%</b>
          </div>
          <div className="wa-progress-bar">
            <div className="wa-progress-fill" style={{ width: `${current.progress * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function Onboarding({ week }) {
  const isW1 = week === "w1";
  const [open, setOpen] = useState(isW1);
  useEffect(() => setOpen(isW1), [isW1]);
  const doneAll = !isW1;

  return (
    <div className="wa-card">
      <button className="wa-ob-head" onClick={() => setOpen(!open)}>
        <div>
          <div className="wa-eyebrow">Onboarding</div>
          <h2 className="wa-h2">
            {doneAll ? "Onboarding — completed Day 10" : "Getting you launched"}
          </h2>
        </div>
        <div className="wa-ob-right">
          {doneAll && <span className="wa-badge-done"><Check size={10} /> 7 of 7 complete</span>}
          {!doneAll && <span className="wa-badge-live">2 of 7 complete</span>}
          <span className={`wa-chevron ${open ? "wa-chevron-open" : ""}`}>▾</span>
        </div>
      </button>

      {open && (
        <div className="wa-ob-list">
          {ONBOARDING.map((o, i) => {
            const state = doneAll ? "done" : W1_ONBOARDING_STATE[i];
            return (
              <div key={i} className={`wa-ob-item wa-ob-${state}`}>
                <div className="wa-ob-marker">
                  {state === "done" ? <Check color="#fff" /> : <span className="wa-ob-num">{i + 1}</span>}
                </div>
                <div className="wa-ob-body">
                  <div className="wa-ob-step">{o.step}</div>
                  <div className="wa-ob-day">{o.day}</div>
                </div>
                {state === "current" && o.cta && (
                  <span className="wa-ob-cta">{o.cta} →</span>
                )}
                {state === "current" && !o.cta && <span className="wa-ob-now">In progress</span>}
                {state === "active" && <span className="wa-ob-active">Underway</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Pipeline({ week }) {
  const isW1 = week === "w1";
  return (
    <div className="wa-card">
      <div className="wa-section-head">
        <div>
          <div className="wa-eyebrow">Pipeline</div>
          <h2 className="wa-h2">From reply to funded deal</h2>
        </div>
        {!isW1 && <div className="wa-pipe-total">Est. pipeline value <b>$685,000</b></div>}
      </div>

      {isW1 ? (
        <div className="wa-empty">
          <div className="wa-empty-mark">◇</div>
          <p><b>Your pipeline builds here after launch.</b></p>
          <p>Once the campaign goes live on Day 21, every positive reply, booked call, and held call appears in this view — with estimated deal value attached.</p>
        </div>
      ) : (
        <div className="wa-pipe-grid">
          {PIPELINE_W6.map((s, i) => (
            <div key={s.stage} className="wa-stage">
              <div className="wa-stage-head">
                <span className="wa-stage-name">{s.stage}</span>
                {i < PIPELINE_W6.length - 1 && <span className="wa-stage-arrow">→</span>}
              </div>
              <div className="wa-stage-count">{s.count}</div>
              <div className="wa-stage-note">{s.note}</div>
              <div className="wa-stage-leads">
                {s.leads.map((l) => (
                  <div key={l.name} className="wa-lead">
                    <div>
                      <div className="wa-lead-name">{l.name}</div>
                      <div className="wa-lead-co">{l.co}</div>
                    </div>
                    <div className="wa-lead-val">{l.val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Calls({ week }) {
  const isW1 = week === "w1";
  return (
    <div className="wa-card">
      <div className="wa-section-head">
        <div>
          <div className="wa-eyebrow">Appointments</div>
          <h2 className="wa-h2">Upcoming booked calls</h2>
        </div>
      </div>
      {isW1 ? (
        <div className="wa-empty wa-empty-slim">
          <p><b>No calls yet — exactly as planned.</b> First booked calls typically land in weeks 4–6. They'll appear here with contact details, deal context, and confirmation status.</p>
        </div>
      ) : (
        <div className="wa-calls">
          {CALLS_W6.map((c) => (
            <div key={c.name} className="wa-call-row">
              <div className="wa-call-when">{c.when}</div>
              <div className="wa-call-who">
                <div className="wa-lead-name">{c.name}</div>
                <div className="wa-lead-co">{c.co}</div>
              </div>
              <div className="wa-call-topic">{c.topic}</div>
              <span className={`wa-status ${c.status === "Confirmed" ? "wa-status-ok" : "wa-status-pend"}`}>
                {c.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlanNote({ week }) {
  const isW1 = week === "w1";
  return (
    <div className="wa-note-row">
      <div className="wa-card wa-note-video">
        <div className="wa-video-thumb">
          <div className="wa-video-grain" />
          <div className="wa-video-play"><Play /></div>
          <div className="wa-video-meta">
            {isW1 ? "Welcome walkthrough · 3:05" : "Week 6 update · 2:14"}
          </div>
        </div>
      </div>
      <div className="wa-card wa-note-text">
        <div className="wa-eyebrow">A note from Alan</div>
        {isW1 ? (
          <>
            <h3 className="wa-note-h">Welcome aboard.</h3>
            <p className="wa-note-p">
              Everything in the first three weeks is deliberate groundwork — domains warming, targeting sharpened,
              messaging approved by you before a single prospect sees it. Quiet weeks now are what make loud weeks later.
              Your next step is the intake form above; everything else is on me.
            </p>
          </>
        ) : (
          <>
            <h3 className="wa-note-h">Momentum is compounding.</h3>
            <p className="wa-note-p">
              Two more calls booked this week and reply quality keeps improving as the data sharpens targeting.
              We're two calls away from the 15-call milestone — I expect to cross it before Friday. Watch for
              Reyes Logistics on Thursday; strongest fit we've seen so far.
            </p>
          </>
        )}
        <div className="wa-note-sig">— Alan · Woods Ascension</div>
      </div>
    </div>
  );
}

/* ================= LOGIN ================= */

function Login({ onEnter }) {
  return (
    <div className="wa-login">
      <div className="wa-login-card">
        <div className="wa-mark">W<span>A</span></div>
        <div className="wa-login-title">Client Portal</div>
        <div className="wa-login-sub">Woods Ascension · Outbound Performance</div>
        <label className="wa-field">
          <span>Email</span>
          <input defaultValue="tomer@autofundingcorp.com" readOnly />
        </label>
        <label className="wa-field">
          <span>Password</span>
          <input type="password" defaultValue="••••••••••" readOnly />
        </label>
        <button className="wa-btn" onClick={onEnter}>Sign in</button>
        <div className="wa-login-foot">Secured client access</div>
      </div>
    </div>
  );
}

/* ================= APP ================= */

export default function App() {
  const [entered, setEntered] = useState(false);
  const [week, setWeek] = useState("w6");
  const isW1 = week === "w1";
  const data = isW1 ? W1_DAILY : W6_DAILY;
  const [show, setShow] = useState({ sends: true, replies: true, bounces: false });

  const toggle = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className="wa-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Instrument+Sans:wght@400;500;600&display=swap');

        :root {
          --ink: #101E2E;
          --ink-soft: #3D4C5E;
          --muted: #77828F;
          --paper: #F3F3EE;
          --card: #FFFFFF;
          --line: #E4E3DA;
          --green: #1E6B4F;
          --green-soft: #E7F1EB;
          --gold: #A87E3F;
          --gold-soft: #F5EDDE;
          --brick: #A9502F;
        }
        * { box-sizing: border-box; margin: 0; }
        .wa-root {
          min-height: 100vh; background: var(--paper); color: var(--ink);
          font-family: 'Instrument Sans', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .wa-shell { max-width: 1080px; margin: 0 auto; padding: 0 28px 64px; }

        /* ---------- header ---------- */
        .wa-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 22px 0 18px; border-bottom: 1px solid var(--line); margin-bottom: 26px;
        }
        .wa-brand { display: flex; align-items: baseline; gap: 14px; }
        .wa-wordmark {
          font-family: 'Fraunces', serif; font-weight: 600; font-size: 15px;
          letter-spacing: 0.14em; text-transform: uppercase;
        }
        .wa-brand-div { width: 1px; height: 16px; background: var(--line); align-self: center; }
        .wa-client { font-size: 13.5px; color: var(--ink-soft); font-weight: 500; }
        .wa-top-right { display: flex; align-items: center; gap: 14px; }
        .wa-sync { font-size: 12px; color: var(--muted); }
        .wa-sync b { color: var(--green); font-weight: 600; }
        .wa-avatar {
          width: 30px; height: 30px; border-radius: 50%; background: var(--ink); color: #fff;
          display: flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 600;
        }

        /* ---------- hero line ---------- */
        .wa-hero { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 22px; flex-wrap: wrap; gap: 16px; }
        .wa-hero h1 {
          font-family: 'Fraunces', serif; font-weight: 500; font-size: 32px; line-height: 1.12;
          letter-spacing: -0.01em; max-width: 560px;
        }
        .wa-hero h1 em { font-style: italic; color: var(--green); }
        .wa-weekbadge {
          font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600;
          color: var(--ink-soft); border: 1px solid var(--line); background: var(--card);
          padding: 7px 12px; border-radius: 999px;
        }

        /* ---------- demo toggle ---------- */
        .wa-demo { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; }
        .wa-demo-label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
        .wa-seg { display: inline-flex; background: #E9E9E2; border-radius: 999px; padding: 3px; }
        .wa-seg button {
          border: 0; background: transparent; font: inherit; font-size: 12.5px; font-weight: 600;
          padding: 6px 16px; border-radius: 999px; cursor: pointer; color: var(--ink-soft);
          transition: all .18s ease;
        }
        .wa-seg button.on { background: var(--ink); color: #fff; }

        /* ---------- cards & sections ---------- */
        .wa-card {
          background: var(--card); border: 1px solid var(--line); border-radius: 14px;
          padding: 24px 26px; margin-bottom: 18px;
          animation: rise .5s ease both;
        }
        @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .wa-card { animation: none; } }
        .wa-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .wa-eyebrow { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin-bottom: 5px; }
        .wa-h2 { font-family: 'Fraunces', serif; font-weight: 500; font-size: 20px; letter-spacing: -0.005em; }

        /* ---------- KPIs ---------- */
        .wa-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
        .wa-kpi {
          background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px 20px;
          animation: rise .5s ease both;
        }
        .wa-kpi-label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin-bottom: 8px; }
        .wa-kpi-value {
          font-family: 'Fraunces', serif; font-weight: 500; font-size: 30px; letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }
        .wa-kpi-detail { font-size: 12px; color: var(--muted); margin-top: 6px; }
        .wa-kpi-detail b { color: var(--green); font-weight: 600; }

        /* ---------- chart ---------- */
        .wa-chart-controls { display: flex; gap: 8px; }
        .wa-chip {
          border: 1px solid var(--line); background: transparent; border-radius: 999px;
          font: inherit; font-size: 12px; font-weight: 600; padding: 5px 12px; cursor: pointer;
          color: var(--muted); display: inline-flex; align-items: center; gap: 6px; transition: all .15s ease;
        }
        .wa-chip .wa-dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
        .wa-chip.on { color: var(--ink); border-color: #CFCEC4; background: #FBFBF8; }
        .wa-chart-note { font-size: 12px; color: var(--muted); margin-top: 14px; display: flex; align-items: center; gap: 7px; }
        .wa-gold-diamond {
          width: 8px; height: 8px; background: var(--gold); transform: rotate(45deg);
          display: inline-block; border-radius: 1.5px;
        }

        .wa-tip {
          background: var(--ink); color: #fff; border-radius: 10px; padding: 10px 13px;
          font-size: 12px; line-height: 1.7; box-shadow: 0 8px 24px rgba(16,30,46,.25);
        }
        .wa-tip-day { font-weight: 600; margin-bottom: 3px; opacity: .75; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
        .wa-tip-row { display: flex; align-items: center; gap: 7px; }
        .wa-tip-row b { margin-left: auto; padding-left: 14px; font-variant-numeric: tabular-nums; }
        .wa-tip .wa-dot { width: 7px; height: 7px; border-radius: 50%; }
        .wa-tip-appt { color: #EBD9B4; font-weight: 600; }

        /* ---------- journey rail ---------- */
        .wa-focus-chip {
          font-size: 12.5px; color: var(--ink-soft); background: var(--gold-soft);
          border: 1px solid #E8DCC2; padding: 7px 13px; border-radius: 999px;
          display: inline-flex; align-items: center; gap: 8px;
        }
        .wa-focus-chip b { color: var(--ink); }
        .wa-pulse {
          width: 8px; height: 8px; border-radius: 50%; background: var(--gold);
          animation: pulse 1.8s ease infinite;
        }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(168,126,63,.4); } 50% { box-shadow: 0 0 0 5px rgba(168,126,63,0); } }
        @media (prefers-reduced-motion: reduce) { .wa-pulse, .wa-node-ring { animation: none; } }

        .wa-rail-wrap { position: relative; padding: 10px 0 4px; }
        .wa-rail-line { position: absolute; top: 26px; left: 4%; right: 4%; height: 2px; background: var(--line); }
        .wa-rail-fill {
          position: absolute; top: 26px; left: 4%; max-width: 92%; height: 2px;
          background: linear-gradient(90deg, var(--green), var(--gold)); transition: width .6s ease;
        }
        .wa-rail-nodes { position: relative; display: grid; grid-template-columns: repeat(7, 1fr); }
        .wa-node { text-align: center; padding: 0 4px; }
        .wa-node-dot {
          width: 32px; height: 32px; border-radius: 50%; margin: 0 auto 10px;
          display: flex; align-items: center; justify-content: center; position: relative;
          background: var(--card); border: 2px solid var(--line);
        }
        .wa-node-done .wa-node-dot { background: var(--green); border-color: var(--green); }
        .wa-node-current .wa-node-dot { background: var(--gold); border-color: var(--gold); }
        .wa-node-ring {
          position: absolute; inset: -6px; border-radius: 50%;
          border: 2px solid rgba(168,126,63,.45); animation: ring 1.8s ease infinite;
        }
        @keyframes ring { 0% { transform: scale(.85); opacity: 1; } 100% { transform: scale(1.25); opacity: 0; } }
        .wa-node-label { font-size: 12px; font-weight: 600; line-height: 1.3; }
        .wa-node-next .wa-node-label { color: var(--muted); font-weight: 500; }
        .wa-node-current .wa-node-label { color: var(--gold); }
        .wa-node-sub { font-size: 11px; color: var(--muted); margin-top: 3px; font-variant-numeric: tabular-nums; }

        .wa-progress-block { margin-top: 22px; border-top: 1px dashed var(--line); padding-top: 16px; }
        .wa-progress-meta { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--ink-soft); margin-bottom: 8px; }
        .wa-progress-meta b { font-variant-numeric: tabular-nums; }
        .wa-progress-bar { height: 8px; border-radius: 999px; background: #ECECe4; overflow: hidden; }
        .wa-progress-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--green), var(--gold)); transition: width .6s ease; }

        /* ---------- onboarding ---------- */
        .wa-ob-head {
          width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 14px;
          background: none; border: 0; padding: 0; font: inherit; text-align: left; cursor: pointer; color: inherit;
        }
        .wa-ob-right { display: flex; align-items: center; gap: 12px; }
        .wa-badge-done {
          display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;
          color: var(--green); background: var(--green-soft); padding: 5px 11px; border-radius: 999px;
        }
        .wa-badge-done svg path { stroke: var(--green); }
        .wa-badge-live { font-size: 12px; font-weight: 600; color: var(--gold); background: var(--gold-soft); padding: 5px 11px; border-radius: 999px; }
        .wa-chevron { color: var(--muted); transition: transform .2s ease; font-size: 13px; }
        .wa-chevron-open { transform: rotate(180deg); }

        .wa-ob-list { margin-top: 20px; display: flex; flex-direction: column; }
        .wa-ob-item {
          display: flex; align-items: center; gap: 14px; padding: 12px 4px;
          border-top: 1px solid #F0EFE8;
        }
        .wa-ob-marker {
          width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: #EDEDE5; color: var(--muted); font-size: 12px; font-weight: 600;
        }
        .wa-ob-done .wa-ob-marker { background: var(--green); }
        .wa-ob-current .wa-ob-marker { background: var(--gold); color: #fff; }
        .wa-ob-active .wa-ob-marker { background: #D9E4DD; color: var(--green); }
        .wa-ob-body { flex: 1; }
        .wa-ob-step { font-size: 13.5px; font-weight: 500; }
        .wa-ob-next .wa-ob-step { color: var(--muted); font-weight: 400; }
        .wa-ob-done .wa-ob-step { color: var(--ink-soft); }
        .wa-ob-day { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
        .wa-ob-cta {
          font-size: 12.5px; font-weight: 600; color: #fff; background: var(--ink);
          padding: 7px 14px; border-radius: 999px; cursor: pointer; white-space: nowrap;
        }
        .wa-ob-now, .wa-ob-active-tag { font-size: 12px; font-weight: 600; color: var(--gold); }
        span.wa-ob-active { font-size: 12px; font-weight: 600; color: var(--green); }

        /* ---------- pipeline ---------- */
        .wa-pipe-total { font-size: 13px; color: var(--ink-soft); }
        .wa-pipe-total b { font-family: 'Fraunces', serif; font-size: 17px; color: var(--green); margin-left: 6px; }
        .wa-pipe-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .wa-stage { background: #FBFBF7; border: 1px solid #EFEEE6; border-radius: 12px; padding: 16px; }
        .wa-stage-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .wa-stage-name { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; color: var(--ink-soft); }
        .wa-stage-arrow { color: #C8C7BC; font-size: 13px; }
        .wa-stage-count { font-family: 'Fraunces', serif; font-size: 30px; font-weight: 500; font-variant-numeric: tabular-nums; }
        .wa-stage-note { font-size: 11.5px; color: var(--muted); margin: 4px 0 12px; }
        .wa-stage-leads { display: flex; flex-direction: column; gap: 8px; }
        .wa-lead {
          display: flex; justify-content: space-between; align-items: center; gap: 8px;
          background: var(--card); border: 1px solid var(--line); border-radius: 9px; padding: 8px 10px;
        }
        .wa-lead-name { font-size: 12.5px; font-weight: 600; }
        .wa-lead-co { font-size: 11.5px; color: var(--muted); }
        .wa-lead-val { font-size: 12px; font-weight: 600; color: var(--green); white-space: nowrap; font-variant-numeric: tabular-nums; }

        /* ---------- calls ---------- */
        .wa-calls { display: flex; flex-direction: column; }
        .wa-call-row {
          display: grid; grid-template-columns: 1.3fr 1fr 1.2fr auto; align-items: center; gap: 14px;
          padding: 13px 4px; border-top: 1px solid #F0EFE8;
        }
        .wa-call-when { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
        .wa-call-topic { font-size: 12.5px; color: var(--ink-soft); }
        .wa-status { font-size: 11.5px; font-weight: 600; padding: 5px 11px; border-radius: 999px; }
        .wa-status-ok { color: var(--green); background: var(--green-soft); }
        .wa-status-pend { color: var(--gold); background: var(--gold-soft); }

        /* ---------- empty states ---------- */
        .wa-empty {
          border: 1px dashed #D9D8CD; border-radius: 12px; padding: 28px; text-align: center;
          color: var(--ink-soft); font-size: 13.5px; line-height: 1.65; background: #FCFCF9;
        }
        .wa-empty p + p { margin-top: 6px; color: var(--muted); max-width: 520px; margin-left: auto; margin-right: auto; }
        .wa-empty-mark { font-size: 22px; color: var(--gold); margin-bottom: 8px; }
        .wa-empty-slim { text-align: left; padding: 18px 22px; }

        /* ---------- note from Alan ---------- */
        .wa-note-row { display: grid; grid-template-columns: 240px 1fr; gap: 18px; }
        .wa-note-video { padding: 10px; margin-bottom: 18px; }
        .wa-video-thumb {
          position: relative; aspect-ratio: 1 / 1; border-radius: 10px; overflow: hidden; cursor: pointer;
          background: linear-gradient(135deg, #16283C 0%, #1E6B4F 130%);
        }
        .wa-video-grain {
          position: absolute; inset: 0;
          background-image: radial-gradient(rgba(255,255,255,.09) 1px, transparent 1px);
          background-size: 5px 5px;
        }
        .wa-video-play {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 52px; height: 52px; border-radius: 50%; background: rgba(255,255,255,.94);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 22px rgba(0,0,0,.3); transition: transform .18s ease;
        }
        .wa-video-thumb:hover .wa-video-play { transform: translate(-50%, -50%) scale(1.07); }
        .wa-video-meta {
          position: absolute; left: 12px; bottom: 10px; color: rgba(255,255,255,.92);
          font-size: 11.5px; font-weight: 600; letter-spacing: .02em;
        }
        .wa-note-text { margin-bottom: 18px; display: flex; flex-direction: column; }
        .wa-note-h { font-family: 'Fraunces', serif; font-style: italic; font-weight: 500; font-size: 21px; margin: 6px 0 10px; }
        .wa-note-p { font-size: 13.5px; line-height: 1.7; color: var(--ink-soft); max-width: 620px; }
        .wa-note-sig { margin-top: auto; padding-top: 14px; font-size: 12px; color: var(--muted); font-weight: 600; }

        /* ---------- footer ---------- */
        .wa-foot {
          display: flex; justify-content: space-between; align-items: center;
          padding-top: 22px; border-top: 1px solid var(--line);
          font-size: 11.5px; color: var(--muted);
        }

        /* ---------- login ---------- */
        .wa-login {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background:
            radial-gradient(900px 500px at 80% -10%, rgba(30,107,79,.10), transparent 60%),
            radial-gradient(700px 420px at 10% 110%, rgba(168,126,63,.10), transparent 60%),
            var(--paper);
          padding: 24px;
        }
        .wa-login-card {
          width: 100%; max-width: 380px; background: var(--card); border: 1px solid var(--line);
          border-radius: 18px; padding: 38px 34px; text-align: center;
          box-shadow: 0 20px 60px rgba(16,30,46,.08); animation: rise .5s ease both;
        }
        .wa-mark {
          font-family: 'Fraunces', serif; font-weight: 600; font-size: 26px;
          width: 58px; height: 58px; margin: 0 auto 18px; border-radius: 50%;
          background: var(--ink); color: #fff; display: flex; align-items: center; justify-content: center;
          letter-spacing: .02em;
        }
        .wa-mark span { color: var(--gold); }
        .wa-login-title { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 500; margin-bottom: 5px; }
        .wa-login-sub { font-size: 12px; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; font-weight: 600; margin-bottom: 26px; }
        .wa-field { display: block; text-align: left; margin-bottom: 14px; }
        .wa-field span { display: block; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; font-weight: 600; color: var(--muted); margin-bottom: 6px; }
        .wa-field input {
          width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 11px 13px;
          font: inherit; font-size: 13.5px; background: #FBFBF8; color: var(--ink);
        }
        .wa-btn {
          width: 100%; border: 0; border-radius: 10px; background: var(--ink); color: #fff;
          font: inherit; font-size: 14px; font-weight: 600; padding: 12px; cursor: pointer;
          margin-top: 8px; transition: background .15s ease;
        }
        .wa-btn:hover { background: #1C2E44; }
        .wa-btn:focus-visible, .wa-chip:focus-visible, .wa-seg button:focus-visible, .wa-ob-head:focus-visible {
          outline: 2px solid var(--gold); outline-offset: 2px;
        }
        .wa-login-foot { margin-top: 18px; font-size: 11px; color: var(--muted); }

        /* ---------- responsive ---------- */
        @media (max-width: 900px) {
          .wa-kpis { grid-template-columns: repeat(2, 1fr); }
          .wa-pipe-grid { grid-template-columns: repeat(2, 1fr); }
          .wa-rail-nodes { grid-template-columns: repeat(4, 1fr); row-gap: 22px; }
          .wa-rail-line, .wa-rail-fill { display: none; }
          .wa-call-row { grid-template-columns: 1fr; gap: 4px; }
          .wa-note-row { grid-template-columns: 1fr; }
          .wa-note-video { max-width: 260px; }
          .wa-hero h1 { font-size: 26px; }
        }
        @media (max-width: 560px) {
          .wa-shell { padding: 0 16px 48px; }
          .wa-kpis { grid-template-columns: 1fr 1fr; gap: 10px; }
          .wa-pipe-grid { grid-template-columns: 1fr; }
          .wa-rail-nodes { grid-template-columns: repeat(2, 1fr); }
          .wa-topbar { flex-wrap: wrap; gap: 10px; }
        }
      `}</style>

      {!entered ? (
        <Login onEnter={() => setEntered(true)} />
      ) : (
        <div className="wa-shell">
          {/* Top bar */}
          <div className="wa-topbar">
            <div className="wa-brand">
              <span className="wa-wordmark">Woods Ascension</span>
              <span className="wa-brand-div" />
              <span className="wa-client">Auto Funding Corp · Client Portal</span>
            </div>
            <div className="wa-top-right">
              <span className="wa-sync"><b>●</b> Synced via Smartlead · 4 min ago</span>
              <div className="wa-avatar">T</div>
            </div>
          </div>

          {/* Demo toggle */}
          <div className="wa-demo">
            <span className="wa-demo-label">Demo timeline</span>
            <div className="wa-seg">
              <button className={isW1 ? "on" : ""} onClick={() => setWeek("w1")}>Week 1 · Onboarding</button>
              <button className={!isW1 ? "on" : ""} onClick={() => setWeek("w6")}>Week 6 · Live</button>
            </div>
          </div>

          {/* Hero */}
          <div className="wa-hero">
            <h1>
              {isW1
                ? <>Groundwork week. Every quiet day here is <em>deliberate</em>.</>
                : <>Thirteen calls booked. The next milestone is <em>two away</em>.</>}
            </h1>
            <span className="wa-weekbadge">{isW1 ? "Week 1 · Day 4" : "Week 6 · Day 42"}</span>
          </div>

          {/* KPIs */}
          <div className="wa-kpis">
            {isW1 ? (
              <>
                <KPI label="Domains live" value={8} detail="Provisioned Day 1" deps={[week]} />
                <KPI label="Inboxes warming" value={24} detail="On schedule for Day 21 launch" deps={[week]} />
                <KPI label="Warmup sends" value={262} detail="Protecting deliverability" deps={[week]} />
                <KPI label="Days to launch" value={17} detail="Launch: Day 21" deps={[week]} accent />
              </>
            ) : (
              <>
                <KPI label="Emails sent" value={9960} detail={<span><b>+18%</b> vs last week</span>} deps={[week]} />
                <KPI label="Positive replies" value={77} detail={<span><b>5</b> today</span>} deps={[week]} />
                <KPI label="Calls booked" value={13} detail={<span><b>2</b> this week</span>} deps={[week]} />
                <KPI label="Pipeline value" value={685} prefix="$" suffix="K" detail="Across booked & held calls" deps={[week]} accent />
              </>
            )}
          </div>

          {/* Chart */}
          <div className="wa-card">
            <div className="wa-section-head">
              <div>
                <div className="wa-eyebrow">Daily activity</div>
                <h2 className="wa-h2">{isW1 ? "Warmup volume" : "Sends, replies & booked calls"}</h2>
              </div>
              <div className="wa-chart-controls">
                <button className={`wa-chip ${show.sends ? "on" : ""}`} onClick={() => toggle("sends")}>
                  <span className="wa-dot" style={{ background: "#B9C4CE" }} />Sends
                </button>
                <button className={`wa-chip ${show.replies ? "on" : ""}`} onClick={() => toggle("replies")}>
                  <span className="wa-dot" style={{ background: "var(--green)" }} />Positive replies
                </button>
                <button className={`wa-chip ${show.bounces ? "on" : ""}`} onClick={() => toggle("bounces")}>
                  <span className="wa-dot" style={{ background: "var(--brick)" }} />Bounces
                </button>
              </div>
            </div>

            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <ComposedChart data={data} margin={{ top: 12, right: 6, left: -14, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#EFEEE6" />
                  <XAxis dataKey="d" tick={{ fontSize: 11, fill: "#77828F" }} tickLine={false} axisLine={{ stroke: "#E4E3DA" }} interval="preserveStartEnd" />
                  <YAxis yAxisId="l" tick={{ fontSize: 11, fill: "#77828F" }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="r" orientation="right" hide domain={[0, 10]} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(16,30,46,.04)" }} />
                  {show.sends && <Bar yAxisId="l" dataKey="sends" fill="#C6CFD8" radius={[4, 4, 0, 0]} maxBarSize={26} />}
                  {show.bounces && <Line yAxisId="r" dataKey="bounces" stroke="var(--brick)" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />}
                  {show.replies && <Line yAxisId="r" dataKey="replies" stroke="var(--green)" strokeWidth={2.5} dot={false} />}
                  {!isW1 && <Line yAxisId="r" dataKey={(row) => (row.appts > 0 ? row.appts + 6.8 : null)} stroke="transparent" dot={<ApptDot />} isAnimationActive={false} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="wa-chart-note">
              {isW1 ? (
                <>Warmup sends build sender reputation before launch — low volume now is what protects inbox placement later.</>
              ) : (
                <><span className="wa-gold-diamond" /> Gold markers are days a call was booked · Bounce rate held at <b style={{ color: "var(--ink)" }}>&nbsp;1.8%</b></>
              )}
            </div>
          </div>

          {/* Journey */}
          <Journey milestones={isW1 ? W1_MILESTONES : W6_MILESTONES} />

          {/* Onboarding */}
          <Onboarding week={week} />

          {/* Pipeline */}
          <Pipeline week={week} />

          {/* Calls */}
          <Calls week={week} />

          {/* Note from Alan */}
          <AlanNote week={week} />

          {/* Footer */}
          <div className="wa-foot">
            <span>Woods Ascension · Outbound performance for lenders & M&A advisors</span>
            <span>Data via Smartlead API · Updated daily</span>
          </div>
        </div>
      )}
    </div>
  );
}
