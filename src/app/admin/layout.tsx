import { redirect } from "next/navigation";
import { getScopedContext } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getScopedContext();

  if (ctx.role !== "ADMIN") {
    redirect("/");
  }

  return <div className="min-h-screen bg-white">{children}</div>;
}
