// Connects Canencia's Google Business Profile via the Places API. Resolves
// the Place ID from name + address so nobody has to hunt for it by hand,
// then seals the API key into ClientIntegration like every other secret.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { sealJson } from "../src/lib/crypto";
import { findPlace } from "../src/lib/places";

const prisma = new PrismaClient();
const CLIENT_ID = "cmsbhlur60000ibgy4084d8fk";
const QUERY = "Canencia Painting 91-1798 Kupeleko Pl Ewa Beach HI 96706";

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY not set in .env");

  const place = await findPlace({ apiKey, query: QUERY });
  if (!place) throw new Error(`No Google listing found for: ${QUERY}`);
  console.log(`Found: ${place.name} (${place.placeId}) — ${place.reviewCount} reviews at ${place.rating}`);

  await prisma.clientIntegration.upsert({
    where: { clientId_provider: { clientId: CLIENT_ID, provider: "GOOGLE_PLACES" } },
    create: {
      clientId: CLIENT_ID,
      provider: "GOOGLE_PLACES",
      config: { placeId: place.placeId, businessName: place.name },
      credentials: sealJson({ apiKey }),
      status: "ACTIVE",
    },
    update: {
      config: { placeId: place.placeId, businessName: place.name },
      credentials: sealJson({ apiKey }),
      status: "ACTIVE",
      lastError: null,
    },
  });
  console.log("Google Places integration connected.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
