import { google, type gmail_v1 } from "googleapis";
import { clientFromRefreshToken } from "@/lib/google-oauth";
import type { GmailMeta } from "@/lib/gmail-parsers";

export type GmailCursor = { historyId?: string; lastInternalDate?: number };

function gmailClient(refreshToken: string): gmail_v1.Gmail {
  return google.gmail({ version: "v1", auth: clientFromRefreshToken(refreshToken) });
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// Walks multipart MIME parts for the plain-text body — most transactional
// email is multipart/alternative with a text/plain part alongside
// text/html. Falls back to tag-stripped HTML if no plain-text part exists.
function extractPlainText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = Buffer.from(payload.body.data, "base64url").toString("utf8");
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

export async function getMessage(refreshToken: string, messageId: string): Promise<{ meta: GmailMeta; text: string } | null> {
  const gmail = gmailClient(refreshToken);
  const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const msg = res.data;
  if (!msg?.id) return null;
  const headers = msg.payload?.headers;
  return {
    meta: {
      id: msg.id,
      internalDate: Number(msg.internalDate ?? Date.now()),
      from: headerValue(headers, "From"),
      subject: headerValue(headers, "Subject"),
    },
    text: extractPlainText(msg.payload),
  };
}

// Lists new message IDs since the cursor. Primary path: history.list
// (cheap, ordered, only what changed). Gmail keeps ~1 week of history;
// once it expires (an error here, typically 404) this falls back to a
// time-window messages.list with a one-hour overlap — safe because
// downstream upserts are keyed on a unique gmailMessageId, so re-seeing a
// message is a harmless no-op.
export async function listNewMessages(
  refreshToken: string,
  cursor: GmailCursor,
): Promise<{ messageIds: string[]; newCursor: GmailCursor }> {
  const gmail = gmailClient(refreshToken);

  if (cursor.historyId) {
    try {
      const res = await gmail.users.history.list({
        userId: "me",
        startHistoryId: cursor.historyId,
        historyTypes: ["messageAdded"],
      });
      const ids = new Set<string>();
      for (const h of res.data.history ?? []) {
        for (const added of h.messagesAdded ?? []) {
          if (added.message?.id) ids.add(added.message.id);
        }
      }
      return {
        messageIds: [...ids],
        newCursor: { historyId: res.data.historyId ?? cursor.historyId, lastInternalDate: cursor.lastInternalDate },
      };
    } catch {
      // History expired or otherwise unusable — fall through to the
      // time-window fallback below rather than failing the whole sync.
    }
  }

  const sinceMs = cursor.lastInternalDate ?? Date.now() - 24 * 60 * 60 * 1000;
  const overlapMs = 60 * 60 * 1000;
  const afterSeconds = Math.floor((sinceMs - overlapMs) / 1000);

  const listRes = await gmail.users.messages.list({ userId: "me", q: `after:${afterSeconds}` });
  const messageIds = (listRes.data.messages ?? []).map((m) => m.id).filter((id): id is string => !!id);

  const profile = await gmail.users.getProfile({ userId: "me" });

  return {
    messageIds,
    newCursor: { historyId: profile.data.historyId ?? cursor.historyId, lastInternalDate: Date.now() },
  };
}
