import { prisma } from "@/lib/prisma";
import { getDashboardScope } from "@/lib/dashboard-scope";
import { exitPreview } from "@/lib/preview-actions";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const scope = await getDashboardScope();

  const client = await prisma.client.findUniqueOrThrow({
    where: { id: scope.clientId },
    select: { heroName: true, name: true, type: true },
  });

  const nextStepsCount =
    client.type === "LOCAL_SERVICES"
      ? await prisma.clientTask.count({ where: { clientId: scope.clientId, status: "OPEN" } })
      : 0;

  return (
    <div className="wa-shell-v2">
      <Sidebar
        clientName={client.heroName ?? client.name}
        showSignOut={!scope.isPreview}
        clientType={client.type}
        nextStepsCount={nextStepsCount}
      />
      <main className="wa-main">
        {scope.isPreview && (
          <div className="wa-preview-banner">
            <span>
              Admin preview — viewing as <b>{client.heroName ?? client.name}</b>
            </span>
            <form action={exitPreview}>
              <button className="wa-preview-exit">Exit preview →</button>
            </form>
          </div>
        )}
        <div className="wa-main-inner">{children}</div>
      </main>
    </div>
  );
}
