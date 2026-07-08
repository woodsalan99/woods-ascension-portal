import { clerkClient } from "@clerk/nextjs/server";
import type { Role } from "@prisma/client";

export async function inviteUser(params: {
  email: string;
  role: Role;
  clientId?: string;
}) {
  const client = await clerkClient();
  return client.invitations.createInvitation({
    emailAddress: params.email,
    publicMetadata: {
      role: params.role,
      clientId: params.clientId ?? null,
    },
  });
}
