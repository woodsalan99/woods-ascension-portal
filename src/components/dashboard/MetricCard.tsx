export type MetricCardVM = {
  label: string;
  value: string;
  subValue?: string;
  rangeText: string | null;
  status: "ON_TRACK" | "NEEDS_ATTENTION";
  tips: string[];
};

export function MetricCard({ label, value, subValue, rangeText, status, tips }: MetricCardVM) {
  return (
    <div className="wa-kpi">
      <div className="wa-kpi-label">{label}</div>
      <div className="wa-kpi-value">{value}</div>
      {subValue && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
          {subValue}
        </div>
      )}
      <span
        className={status === "ON_TRACK" ? "wa-badge-done" : "wa-badge-live"}
        style={{ marginTop: 8, display: "inline-block" }}
      >
        {status === "ON_TRACK" ? "On track" : "Needs attention"}
      </span>
      {rangeText && (
        <div className="wa-kpi-detail" style={{ marginTop: 8 }}>
          {rangeText}
        </div>
      )}
      {tips.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>How Woods Ascension improves this</div>
          <ul style={{ paddingLeft: 16, listStyle: "disc" }}>
            {tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
