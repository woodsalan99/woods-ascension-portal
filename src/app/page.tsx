import { redirect } from "next/navigation";
import { getScopedContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const ctx = await getScopedContext();

  if (ctx.role === "ADMIN") {
    redirect("/admin");
  }

  if (!ctx.clientId) {
    throw new Error("CLIENT user has no clientId assigned");
  }

  const client = await prisma.client.findUniqueOrThrow({
    where: { id: ctx.clientId },
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F3F3EE]">
      <h1 className="text-2xl font-semibold text-[#101E2E]">
        {client.heroName ?? client.name}
      </h1>
      <p className="mt-2 text-[#77828F]">
        Dashboard skeleton — full UI ships in Module D.
      </p>
    </div>
  );
}
