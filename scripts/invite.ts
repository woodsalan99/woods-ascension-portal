import "dotenv/config";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

async function main() {
  const [, , email, role, clientSlug] = process.argv;
  if (!email || !role) {
    console.error("Usage: tsx scripts/invite.ts <email> <ADMIN|CLIENT> [clientSlug]");
    process.exit(1);
  }

  let clientId: string | undefined;
  if (role === "CLIENT") {
    if (!clientSlug) {
      console.error("clientSlug is required for CLIENT invites");
      process.exit(1);
    }
    const client = await prisma.client.findUniqueOrThrow({
      where: { slug: clientSlug },
    });
    clientId = client.id;
  }

  const invitation = await clerk.invitations.createInvitation({
    emailAddress: email,
    publicMetadata: { role, clientId: clientId ?? null },
  });

  console.log("Invitation sent:", invitation.id, "->", email, role, clientId ?? "");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
