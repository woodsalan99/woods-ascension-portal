import { getDashboardScope } from "@/lib/dashboard-scope";
import { prisma } from "@/lib/prisma";
import { ColdEmailOverview } from "@/components/dashboard/ColdEmailOverview";
import { LsOverview } from "@/components/dashboard/LsOverview";

// "/" is the one route shared by both client types (see
// IMPLEMENTATION_STATE.md D-A) — every other page can guard on
// requireClientType, but Overview has to fork instead, since there's
// nowhere else to send someone standing on their own home page.
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const scope = await getDashboardScope();
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: scope.clientId },
    select: { type: true },
  });
  const { p } = await searchParams;

  return client.type === "LOCAL_SERVICES" ? <LsOverview period={p} /> : <ColdEmailOverview />;
}
