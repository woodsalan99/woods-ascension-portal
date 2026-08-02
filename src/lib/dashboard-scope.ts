import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getScopedContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ClientType } from "@prisma/client";

export const PREVIEW_COOKIE = "wa_preview_client";

export type DashboardScope = { clientId: string; isPreview: boolean };

// Resolves which client's dashboard to render:
// - CLIENT users always see their own client.
// - ADMIN users see a client only when they've entered "view as client"
//   preview mode (a cookie set by an admin-only action). Otherwise they're
//   bounced to the admin panel. The cookie is honored ONLY for ADMINs, so a
//   CLIENT forging it can never widen their scope.
export async function getDashboardScope(): Promise<DashboardScope> {
  const ctx = await getScopedContext();

  if (ctx.role === "CLIENT") {
    if (!ctx.clientId) throw new Error("CLIENT user has no clientId assigned");
    return { clientId: ctx.clientId, isPreview: false };
  }

  const previewId = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (previewId) return { clientId: previewId, isPreview: true };

  redirect("/admin");
}

// Same resolution as getDashboardScope, but also bounces to "/" (the
// Overview fork, which sends the user to the right home for their actual
// type) when the resolved client isn't the type this page is built for.
// Guards both directions: COLD_EMAIL-only pages (metrics, appointments,
// roadmap, infrastructure, changelog) require COLD_EMAIL; every new
// LOCAL_SERVICES page requires LOCAL_SERVICES. Honors admin preview mode
// the same as getDashboardScope, since it's built on top of it.
export async function requireClientType(type: ClientType): Promise<DashboardScope> {
  const scope = await getDashboardScope();
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: scope.clientId },
    select: { type: true },
  });
  if (client.type !== type) {
    redirect("/");
  }
  return scope;
}

// Same resolution as getDashboardScope, but for the CLIENT-role write
// actions in (dashboard)/actions.ts — an admin previewing a client can
// exercise those actions too (that's the point of "view as client"), writing
// against the previewed clientId instead of throwing. Never redirects: write
// actions should error loudly, not bounce the request.
export async function requireDashboardWriteScope(): Promise<DashboardScope> {
  const ctx = await getScopedContext();

  if (ctx.role === "CLIENT") {
    if (!ctx.clientId) throw new Error("CLIENT user has no clientId assigned");
    return { clientId: ctx.clientId, isPreview: false };
  }

  if (ctx.role === "ADMIN") {
    const previewId = (await cookies()).get(PREVIEW_COOKIE)?.value;
    if (previewId) return { clientId: previewId, isPreview: true };
  }

  throw new Error("Client role (or an admin in preview mode) is required");
}
