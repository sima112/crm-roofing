/**
 * Field-level AES-256-GCM encryption — SERVER ONLY.
 * Uses the Web Crypto API (available in Node 18+ / Edge runtime).
 * Encrypted values are stored as "enc:<base64(iv+ciphertext+tag)>"
 */

import "server-only";

const PREFIX      = "enc:";
const KEY_ENV_VAR = "ENCRYPTION_KEY"; // 32-byte hex string, e.g. openssl rand -hex 32

function getKeyHex(): string {
  const k = process.env[KEY_ENV_VAR];
  if (!k || k.length < 64) {
    throw new Error(
      `${KEY_ENV_VAR} env var is missing or too short. ` +
      `Generate one with: openssl rand -hex 32`
    );
  }
  return k;
}

async function importKey(): Promise<CryptoKey> {
  const hex    = getKeyHex();
  const bytes  = new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Encrypt a plaintext string. Returns "enc:<base64>" or throws. */
export async function encryptField(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(PREFIX)) return plaintext; // already encrypted

  const key = await importKey();
  const iv  = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  // Prepend IV (12 bytes) to ciphertext+tag
  const combined = new Uint8Array(iv.byteLength + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.byteLength);

  return PREFIX + Buffer.from(combined).toString("base64");
}

/** Decrypt a value previously encrypted with encryptField. Returns plaintext. */
export async function decryptField(ciphertext: string): Promise<string> {
  if (!ciphertext) return ciphertext;
  if (!ciphertext.startsWith(PREFIX)) return ciphertext; // not encrypted — return as-is

  const key     = await importKey();
  const combined = Buffer.from(ciphertext.slice(PREFIX.length), "base64");
  const iv        = combined.subarray(0, 12);
  const data      = combined.subarray(12);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return new TextDecoder().decode(plainBuffer);
}

/** Returns true if a stored value is encrypted */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Decrypt a nullable field — returns null if input is null/undefined */
export async function decryptNullable(value: string | null | undefined): Promise<string | null> {
  if (value == null) return null;
  return decryptField(value);
}

/**
 * Encrypt an object's sensitive fields in-place.
 * Pass the object and a list of field keys to encrypt.
 */
export async function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): Promise<T> {
  const result = { ...obj };
  for (const field of fields) {
    if (typeof result[field] === "string") {
      (result as Record<string, unknown>)[field as string] = await encryptField(result[field] as string);
    }
  }
  return result;
}

/**
 * Decrypt an object's sensitive fields in-place.
 */
export async function decryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): Promise<T> {
  const result = { ...obj };
  for (const field of fields) {
    if (typeof result[field] === "string") {
      (result as Record<string, unknown>)[field as string] = await decryptField(result[field] as string);
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: field lists per table
// ─────────────────────────────────────────────────────────────────────────────

export const CUSTOMER_ENCRYPTED_FIELDS = ["phone", "email", "address"] as const;
export const INVOICE_ENCRYPTED_FIELDS  = ["notes"] as const;
