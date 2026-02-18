/**
 * Envelope Encryption for OAuth Tokens — SEC-008
 *
 * AES-256-GCM encryption for sensitive values stored in the database.
 * Used to encrypt OAuth access tokens, refresh tokens, and webhook URLs
 * for Discord, Slack, and HubSpot integrations.
 *
 * Format: enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 *
 * The decrypt function auto-detects plaintext vs encrypted values,
 * enabling graceful migration of existing unencrypted tokens.
 *
 * @example
 * import { encrypt, decrypt } from '@/lib/encryption';
 *
 * const encrypted = encrypt('my-secret-token');
 * const decrypted = decrypt(encrypted); // 'my-secret-token'
 * const legacy = decrypt('plaintext-token'); // 'plaintext-token' (passthrough)
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const PREFIX = "enc:";

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      "ENCRYPTION_KEY not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)");
  }
  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a string in format: enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt an encrypted string. If the value doesn't have the enc: prefix,
 * returns it as-is (graceful migration for plaintext legacy values).
 */
export function decrypt(value: string): string {
  // Plaintext passthrough — enables graceful migration
  if (!value.startsWith(PREFIX)) {
    return value;
  }

  const key = getKey();
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Encrypt all sensitive string values in an integration data object.
 * Only encrypts values for known sensitive keys.
 */
const SENSITIVE_INTEGRATION_KEYS = new Set([
  "accessToken",
  "refreshToken",
  "webhookUrl",
]);

export function encryptIntegrationData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const encrypted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_INTEGRATION_KEYS.has(key) && typeof value === "string" && value.length > 0) {
      encrypted[key] = encrypt(value);
    } else {
      encrypted[key] = value;
    }
  }
  return encrypted;
}

/**
 * Decrypt all sensitive string values in an integration data object.
 * Handles both encrypted and plaintext values (graceful migration).
 */
export function decryptIntegrationData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const decrypted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_INTEGRATION_KEYS.has(key) && typeof value === "string" && value.length > 0) {
      decrypted[key] = decrypt(value);
    } else {
      decrypted[key] = value;
    }
  }
  return decrypted;
}
