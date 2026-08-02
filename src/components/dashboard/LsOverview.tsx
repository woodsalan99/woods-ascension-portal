import { getDashboardScope } from "@/lib/dashboard-scope";
import { prisma } from "@/lib/prisma";

// Phase 1 placeholder — proves the LOCAL_SERVICES shell renders end to end.
// Replaced with the real registry/resolver-driven Overview in Phase 2
// (IMPLEMENTATION_STATE.md §3a/§3c). Deliberately does not call any
// COLD_EMAIL data helper (getDashboardClient, dashboard-compute) — those
// are shaped around DailyStat/PipelineEntry and don't apply here.
export async function LsOverview() {
  const scope = await getDashboardScope();
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: scope.clientId },
    select: { heroName: true, name: true },
  });

  return (
    <div className="wa-card">
      <div className="wa-eyebrow">Overview</div>
      <h1 className="wa-page-title">Welcome, {client.heroName ?? client.name}.</h1>
      <p className="wa-page-sub">
        Your portal is being built out — leads, where you rank, the numbers, and your
        monthly recap will appear here as each piece comes online.
      </p>
    </div>
  );
}
