"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PREVIEW_COOKIE } from "@/lib/dashboard-scope";

export async function setPreviewClient(clientId: string) {
  await requireAdmin();
  // Validate the client exists before entering preview.
  await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  (await cookies()).set(PREVIEW_COOKIE, clientId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect("/");
}

export async function exitPreview() {
  (await cookies()).delete(PREVIEW_COOKIE);
  redirect("/admin");
}
