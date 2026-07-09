"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function AudienceFilter({
  audiences,
}: {
  audiences: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("audience") ?? "";

  return (
    <select
      className="wa-select"
      value={current}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) {
          params.set("audience", e.target.value);
        } else {
          params.delete("audience");
        }
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
      }}
    >
      <option value="">All audiences</option>
      {audiences.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}
