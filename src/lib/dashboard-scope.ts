import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getScopedContext } from "@/lib/auth";

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
