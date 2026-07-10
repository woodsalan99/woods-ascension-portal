import { prisma } from "@/lib/prisma";
import { getScopedContext } from "@/lib/auth";

// Serves a document's bytes, inline by default or as a download with
// ?download=1. Access is scoped: ADMINs can see any doc; CLIENTs only their
// own client's — same tenancy guarantee as the rest of the app (§4).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let ctx;
  try {
    ctx = await getScopedContext();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return new Response("Not found", { status: 404 });

  if (ctx.role !== "ADMIN" && doc.clientId !== ctx.clientId) {
    return new Response("Forbidden", { status: 403 });
  }

  const download = new URL(req.url).searchParams.get("download") === "1";
  const disposition = download ? "attachment" : "inline";

  return new Response(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(doc.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
