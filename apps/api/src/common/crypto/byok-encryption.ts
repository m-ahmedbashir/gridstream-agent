import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * AES-256-GCM encryption for user-supplied (BYOK) provider API keys.
 *
 * Pure functions, deliberately free of NestJS/env/DI concerns — the key is
 * always passed in explicitly, so this can be unit tested directly with a
 * fixed test key, with no app bootstrap and no environment variable needed.
 * `EncryptionService` (in this same folder) is the thin DI wrapper that reads
 * the real key from `BYOK_ENCRYPTION_KEY` and delegates to these.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // recommended nonce length for GCM
const KEY_LENGTH_BYTES = 32; // AES-256

export class InvalidEncryptionKeyError extends Error {
  constructor(actualLength: number) {
    super(
      `BYOK encryption key must decode to exactly ${KEY_LENGTH_BYTES} bytes (AES-256), got ${actualLength}. ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
}

function toKeyBuffer(keyBase64: string): Buffer {
  const keyBuffer = Buffer.from(keyBase64, 'base64');
  if (keyBuffer.length !== KEY_LENGTH_BYTES) {
    throw new InvalidEncryptionKeyError(keyBuffer.length);
  }
  return keyBuffer;
}

/**
 * Encrypts a plaintext secret (e.g. a user-supplied provider API key).
 * A fresh random IV is generated per call, so encrypting the same plaintext
 * twice never produces the same ciphertext.
 *
 * @returns `${iv}:${authTag}:${ciphertext}`, each base64-encoded.
 */
export function encryptSecret(plaintext: string, keyBase64: string): string {
  const key = toKeyBuffer(keyBase64);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/**
 * Decrypts a value produced by {@link encryptSecret}.
 * Throws if the ciphertext or auth tag has been tampered with, or if the
 * wrong key is used — GCM's authentication tag makes both detectable rather
 * than silently returning corrupted plaintext.
 */
export function decryptSecret(encoded: string, keyBase64: string): string {
  const key = toKeyBuffer(keyBase64);
  const parts = encoded.split(':');
  if (parts.length !== 3) {
    throw new Error(
      'Malformed encrypted value — expected "iv:authTag:ciphertext".',
    );
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(), // throws here if auth tag / key / ciphertext don't match
  ]);

  return plaintext.toString('utf-8');
}
