import { prisma } from "@/lib/prisma";
import { getScopedContext } from "@/lib/auth";

// Serves a job photo a client uploaded. Same tenancy pattern as
// /api/documents/[id] — admins see any, clients only their own.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let ctx;
  try {
    ctx = await getScopedContext();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const sub = await prisma.taskSubmission.findUnique({ where: { id }, include: { task: true } });
  if (!sub?.fileData) return new Response("Not found", { status: 404 });

  if (ctx.role !== "ADMIN" && sub.task.clientId !== ctx.clientId) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(new Uint8Array(sub.fileData), {
    headers: { "Content-Type": sub.fileType ?? "image/webp", "Cache-Control": "private, max-age=3600" },
  });
}
