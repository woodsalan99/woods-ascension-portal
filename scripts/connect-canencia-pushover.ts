// One-time (idempotent) setup: Alan's own Pushover channel (admin-wide,
// active) and Canencia's shared Bryan/Desiree channel (client-scoped,
// INACTIVE ON PURPOSE — Alan does not want them receiving anything yet;
// this just stores it ready for whenever he flips it on). Reads all
// values from .env — nothing hardcoded here.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CANENCIA_CLIENT_ID = "cmsbhlur60000ibgy4084d8fk";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set in .env`);
  return v;
}

async function main() {
  const alanToken = requireEnv("PUSHOVER_ALAN_TOKEN");
  const alanUserKey = requireEnv("PUSHOVER_ALAN_USER_KEY");
  const canenciaToken = requireEnv("PUSHOVER_CANENCIA_TOKEN");
  const canenciaUserKey = requireEnv("PUSHOVER_CANENCIA_USER_KEY");

  const existingAlan = await prisma.notificationChannel.findFirst({
    where: { clientId: null, channel: "PUSHOVER", address: alanUserKey },
  });
  if (existingAlan) {
    await prisma.notificationChannel.update({
      where: { id: existingAlan.id },
      data: { token: alanToken, active: true },
    });
  } else {
    await prisma.notificationChannel.create({
      data: { clientId: null, userId: null, channel: "PUSHOVER", address: alanUserKey, token: alanToken, active: true },
    });
  }

  const existingCanencia = await prisma.notificationChannel.findFirst({
    where: { clientId: CANENCIA_CLIENT_ID, channel: "PUSHOVER", address: canenciaUserKey },
  });
  if (existingCanencia) {
    await prisma.notificationChannel.update({
      where: { id: existingCanencia.id },
      // active stays false — do NOT flip this on here, Alan will do that explicitly later.
      data: { token: canenciaToken },
    });
  } else {
    await prisma.notificationChannel.create({
      data: {
        clientId: CANENCIA_CLIENT_ID,
        userId: null,
        channel: "PUSHOVER",
        address: canenciaUserKey,
        token: canenciaToken,
        active: false, // Alan: do NOT send anything to Bryan/Desiree yet
      },
    });
  }

  const rows = await prisma.notificationChannel.findMany({
    where: { OR: [{ clientId: null }, { clientId: CANENCIA_CLIENT_ID }] },
    select: { id: true, clientId: true, active: true, address: true },
  });
  console.log("Notification channels now:", rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
