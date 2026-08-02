import { prisma } from "@/lib/prisma";

// Pushover notifications (handoff §5) — the primary/only live channel for
// this build (EMAIL/SMS channel types are stubbed in the schema but not
// implemented here). Every call writes a Notification row recording the
// delivery result, whether or not any channel was configured yet.
export type NotificationKind = "NEW_LEAD" | "TASK_SUBMISSION" | "WATCHDOG" | "SYNC_FAILURE" | "REVIEW_REQUEST";

async function sendPushover(userKey: string, title: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.PUSHOVER_APP_TOKEN;
  if (!token) return { ok: false, error: "PUSHOVER_APP_TOKEN not configured" };
  try {
    const res = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token, user: userKey, title, message }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Pushover ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Fans out to every active PUSHOVER channel scoped to this client, plus
// every admin-wide channel (clientId=null — Alan's own). A new qualified
// lead, for example, pings both the client's shared Pushover and Alan's;
// WATCHDOG/SYNC_FAILURE are Alan-only by convention (callers pass
// toClient: false for those).
export async function notify(params: {
  clientId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  toClient?: boolean;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { clientId, kind, title, message, toClient = true, payload = {} } = params;

  const channels = await prisma.notificationChannel.findMany({
    where: {
      active: true,
      channel: "PUSHOVER",
      OR: [{ clientId: null }, ...(toClient ? [{ clientId }] : [])],
    },
  });

  if (channels.length === 0) {
    // Nothing configured yet — still log the attempt so it's visible in
    // the admin panel that a notification had nowhere to go, rather than
    // silently vanishing.
    await prisma.notification.create({
      data: { clientId, kind, payload: { ...payload, title, message }, error: "No active PUSHOVER channels configured" },
    });
    return;
  }

  for (const ch of channels) {
    const result = await sendPushover(ch.address, title, message);
    await prisma.notification.create({
      data: {
        clientId,
        kind,
        payload: { ...payload, title, message, channelId: ch.id },
        deliveredAt: result.ok ? new Date() : null,
        error: result.ok ? null : result.error,
      },
    });
  }
}
