import { prisma } from "@/lib/prisma";

export async function getDashboardClient(clientId: string) {
  return prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    include: {
      dailyStats: { orderBy: { date: "asc" } },
      milestones: { orderBy: { sortOrder: "asc" } },
      onboarding: { orderBy: { sortOrder: "asc" } },
      pipeline: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { calls: { orderBy: { date: "asc" } } },
      },
      notes: { where: { published: true }, orderBy: { weekOf: "desc" }, take: 1 },
      audiences: {
        orderBy: { sortOrder: "asc" },
        include: { dailyStats: { orderBy: { date: "asc" } } },
      },
      infrastructure: { orderBy: { sortOrder: "asc" } },
      metricConfigs: true,
    },
  });
}

export type DashboardClient = Awaited<ReturnType<typeof getDashboardClient>>;
