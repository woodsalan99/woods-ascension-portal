// One-time (idempotent) setup: seals Canencia's real CallRail API key into
// ClientIntegration. Reads the key from CALLRAIL_API_KEY_CANENCIA in .env
// (never hardcoded here) — re-running is safe, it just re-upserts.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { sealJson } from "../src/lib/crypto";

const prisma = new PrismaClient();
const CLIENT_ID = "cmsbhlur60000ibgy4084d8fk"; // Canencia Painting

async function main() {
  const apiKey = process.env.CALLRAIL_API_KEY_CANENCIA;
  if (!apiKey) throw new Error("CALLRAIL_API_KEY_CANENCIA not set in .env");

  await prisma.clientIntegration.upsert({
    where: { clientId_provider: { clientId: CLIENT_ID, provider: "CALLRAIL" } },
    create: {
      clientId: CLIENT_ID,
      provider: "CALLRAIL",
      config: {
        accountId: "ACCab2e1df83f0c4075b0669784e9ec11aa", // "Woods Web" shared agency account
        companyId: "COM019ddc83d8ce7a449d488ce07b31ac42", // Canencia Painting company within it
        lsaTrackingNumbers: [], // LSA bypasses CallRail entirely for Canencia (Alan, 2026-08-02)
      },
      credentials: sealJson({ apiKey }),
      status: "ACTIVE",
    },
    update: {
      credentials: sealJson({ apiKey }),
      status: "ACTIVE",
      lastError: null,
    },
  });

  console.log("Canencia CallRail integration connected.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
