import { runWatchdog } from "@/lib/watchdog";

// The watchdog also runs off the back of the hourly Smartlead sync, so it
// needs no Railway service of its own. This route exists so it can be
// triggered by hand, and so it can be given its own schedule later without
// touching anything else.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const result = await runWatchdog();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
