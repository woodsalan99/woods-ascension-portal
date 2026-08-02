import { prisma } from "@/lib/prisma";
import { openJson } from "@/lib/crypto";
import { sendEmail } from "@/lib/gmail";

// Notification fan-out (handoff §5). Two live channels:
//   PUSHOVER — short phone alert. Always sent.
//   EMAIL    — a fuller summary, only sent when the caller supplies
//              `emailBody`. Sent as the client's connected Gmail account,
//              so it arrives from Alan's address.
// SMS remains a schema stub only.
//
// Every attempt writes a Notification row with its delivery result, so a
// misconfigured or inactive channel is visible in the data rather than
// silently going nowhere. Channels are opt-in via `active` — that flag is
// the single switch controlling whether the client's people get pinged at
// all (currently off for Bryan/Desiree by Alan's explicit instruction).
export type NotificationKind = "NEW_LEAD" | "TASK_SUBMISSION" | "WATCHDOG" | "SYNC_FAILURE" | "REVIEW_REQUEST";

async function sendPushover(
  userKey: string,
  channelToken: string | null,
  title: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  // Real setups can have more than one Pushover "application" (Alan's own
  // vs. a client's shared one) — a channel's own token wins, falling back
  // to the global default for a channel that doesn't specify one.
  const token = channelToken ?? process.env.PUSHOVER_APP_TOKEN;
  if (!token) return { ok: false, error: "No Pushover app token configured (neither channel-specific nor PUSHOVER_APP_TOKEN)" };
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

async function sendEmailChannel(
  clientId: string,
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const integ = await prisma.clientIntegration.findUnique({
      where: { clientId_provider: { clientId, provider: "GMAIL" } },
    });
    if (!integ) return { ok: false, error: "No GMAIL integration connected for this client" };
    const { refreshToken } = openJson<{ refreshToken: string }>(integ.credentials);
    await sendEmail({ refreshToken, to: [to], subject, body });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // The most likely failure by far: the stored token predates the
    // gmail.send scope being added. Say so plainly rather than leaving a
    // raw 403 in the log.
    if (/insufficient|scope|403/i.test(msg)) {
      return { ok: false, error: `Gmail send permission missing — reconnect Gmail to grant it. (${msg})` };
    }
    return { ok: false, error: msg };
  }
}

export async function notify(params: {
  clientId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  /** Supply to also send an EMAIL-channel message. Omit for phone-only alerts. */
  emailBody?: string;
  toClient?: boolean;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { clientId, kind, title, message, emailBody, toClient = true, payload = {} } = params;

  const channels = await prisma.notificationChannel.findMany({
    where: {
      active: true,
      channel: emailBody ? { in: ["PUSHOVER", "EMAIL"] } : "PUSHOVER",
      OR: [{ clientId: null }, ...(toClient ? [{ clientId }] : [])],
    },
  });

  if (channels.length === 0) {
    await prisma.notification.create({
      data: { clientId, kind, payload: { ...payload, title, message }, error: "No active notification channels configured" },
    });
    return;
  }

  for (const ch of channels) {
    const result =
      ch.channel === "EMAIL"
        ? await sendEmailChannel(clientId, ch.address, title, emailBody!)
        : await sendPushover(ch.address, ch.token, title, message);

    await prisma.notification.create({
      data: {
        clientId,
        kind,
        payload: { ...payload, title, message, channelId: ch.id, channel: ch.channel },
        deliveredAt: result.ok ? new Date() : null,
        error: result.ok ? null : result.error,
      },
    });
  }
}
