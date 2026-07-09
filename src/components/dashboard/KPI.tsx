"use client";

import { useEffect, useState } from "react";

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVal(target);
      return;
    }
    let raf: number;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function KPI({
  label,
  value,
  prefix = "",
  suffix = "",
  detail,
  accent,
}: {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  detail?: React.ReactNode;
  accent?: boolean;
}) {
  const isNumeric = typeof value === "number";
  const counted = useCountUp(isNumeric ? value : 0);
  return (
    <div className="wa-kpi">
      <div className="wa-kpi-label">{label}</div>
      <div
        className="wa-kpi-value"
        style={accent ? { color: "var(--green)" } : undefined}
      >
        {prefix}
        {isNumeric ? fmt(counted) : value}
        {suffix}
      </div>
      {detail && <div className="wa-kpi-detail">{detail}</div>}
    </div>
  );
}
