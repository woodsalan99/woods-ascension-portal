import { redirect } from "next/navigation";
import { getScopedContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getScopedContext();

  if (ctx.role === "ADMIN") {
    redirect("/admin");
  }
  if (!ctx.clientId) {
    throw new Error("CLIENT user has no clientId assigned");
  }

  const client = await prisma.client.findUniqueOrThrow({
    where: { id: ctx.clientId },
    select: { heroName: true, name: true },
  });

  return (
    <div className="wa-shell-v2">
      <Sidebar clientName={client.heroName ?? client.name} />
      <main className="wa-main">
        <div className="wa-main-inner">{children}</div>
      </main>
    </div>
  );
}
