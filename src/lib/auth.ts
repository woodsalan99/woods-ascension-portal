import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type ScopedContext = {
  userId: string;
  role: Role;
  clientId: string | null;
};

/**
 * The only path by which server code may resolve "who is asking and what
 * are they scoped to." Every client-facing data-access function must call
 * this and pass clientId into its queries — see §4.
 */
export async function getScopedContext(): Promise<ScopedContext> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throw new Error("Not authenticated");
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    throw new Error("Authenticated Clerk user has no matching User record");
  }

  return { userId: user.id, role: user.role, clientId: user.clientId };
}

export async function requireAdmin(): Promise<ScopedContext> {
  const ctx = await getScopedContext();
  if (ctx.role !== "ADMIN") {
    throw new Error("Admin role required");
  }
  return ctx;
}

export async function requireClient(): Promise<
  ScopedContext & { clientId: string }
> {
  const ctx = await getScopedContext();
  if (ctx.role !== "CLIENT" || !ctx.clientId) {
    throw new Error("Client role with a clientId is required");
  }
  return ctx as ScopedContext & { clientId: string };
}
