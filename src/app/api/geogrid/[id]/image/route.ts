import { prisma } from "@/lib/prisma";
import { getScopedContext } from "@/lib/auth";

// Serves a Local Falcon map export. Same tenancy pattern as
// /api/documents/[id]: admins can see any, clients only their own.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let ctx;
  try {
    ctx = await getScopedContext();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const scan = await prisma.geogridScan.findUnique({ where: { id } });
  if (!scan?.mapImage) return new Response("Not found", { status: 404 });

  if (ctx.role !== "ADMIN" && scan.clientId !== ctx.clientId) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(new Uint8Array(scan.mapImage), {
    headers: {
      "Content-Type": scan.mapImageType ?? "image/webp",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
