import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Seals ClientIntegration.credentials (refresh tokens, API keys) with
// AES-256-GCM. Storage format is one Bytes blob: iv(12) | authTag(16) |
// ciphertext. Prisma 6 returns Bytes columns as Uint8Array on read (not
// Buffer) — openJson accepts either.
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY not configured");
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must decode (base64) to exactly 32 bytes for AES-256");
  return buf;
}

export function sealJson(data: unknown): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

export function openJson<T = unknown>(sealed: Uint8Array): T {
  const buf = Buffer.from(sealed);
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
