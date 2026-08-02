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

export function sealJson(data: unknown): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const sealed = Buffer.concat([iv, tag, ciphertext]);
  // Copy into a freshly-allocated Uint8Array backed by a genuine
  // ArrayBuffer — Buffer's ArrayBufferLike (which could theoretically be a
  // SharedArrayBuffer) isn't assignable to Prisma's Bytes field type under
  // strict TS lib settings, and `new Uint8Array(buffer)` still inherits
  // Buffer's wider generic, so this needs an explicit allocate-and-copy.
  const out = new Uint8Array(sealed.length);
  out.set(sealed);
  // TS's lib typings here insist on Uint8Array<ArrayBuffer> specifically
  // (vs. the wider ArrayBufferLike every runtime Uint8Array actually
  // satisfies) — an assertion is the standard escape hatch for this known
  // friction point, not a real type-safety gap.
  return out as Uint8Array<ArrayBuffer>;
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
