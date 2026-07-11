"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PERIOD_LABELS, PERIOD_ORDER } from "@/lib/dashboard-compute";

export function PeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("period") ?? "ALL_TIME";

  return (
    <select
      className="wa-select"
      value={current}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("period", e.target.value);
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      {PERIOD_ORDER.map((p) => (
        <option key={p} value={p}>
          {PERIOD_LABELS[p]}
        </option>
      ))}
    </select>
  );
}
