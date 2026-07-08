import { headers } from "next/headers";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

// Provisions our User row when an admin-invited Clerk user completes
// sign-up. role/clientId travel as publicMetadata on the Clerk invitation
// (set by the invite action in Module E) so no nullable clerkId or
// separate "pending invite" table is needed — see §5 Change Protocol note.
export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("CLERK_WEBHOOK_SECRET not configured", {
      status: 500,
    });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(webhookSecret);

  let event: WebhookEvent;
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "user.created") {
    const clerkUser = event.data;
    const email = clerkUser.email_addresses.find(
      (e) => e.id === clerkUser.primary_email_address_id,
    )?.email_address;

    if (!email) {
      return new Response("Clerk user has no primary email", { status: 400 });
    }

    const metadata = clerkUser.public_metadata as {
      role?: Role;
      clientId?: string;
    };

    if (!metadata.role) {
      return new Response("Missing role in invitation metadata", {
        status: 400,
      });
    }

    await prisma.user.upsert({
      where: { email },
      create: {
        clerkId: clerkUser.id,
        email,
        role: metadata.role,
        clientId: metadata.clientId ?? null,
      },
      update: {
        clerkId: clerkUser.id,
      },
    });
  }

  return new Response("OK", { status: 200 });
}
