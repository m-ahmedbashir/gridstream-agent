import { randomBytes } from 'crypto';
import {
  encryptSecret,
  decryptSecret,
  InvalidEncryptionKeyError,
} from './byok-encryption';

const TEST_KEY = randomBytes(32).toString('base64');
const OTHER_KEY = randomBytes(32).toString('base64');

describe('byok-encryption', () => {
  describe('round-trip', () => {
    it('decrypts back to the exact original plaintext', () => {
      const plaintext = 'sk-proj-abc123-a-real-looking-api-key';
      const encrypted = encryptSecret(plaintext, TEST_KEY);

      expect(decryptSecret(encrypted, TEST_KEY)).toBe(plaintext);
    });

    it('round-trips unicode and unusual characters correctly', () => {
      const plaintext = 'key-with-emoji-🔑-and-symbols-!@#$%^&*()_+={}[]';
      const encrypted = encryptSecret(plaintext, TEST_KEY);

      expect(decryptSecret(encrypted, TEST_KEY)).toBe(plaintext);
    });

    it('round-trips an empty string', () => {
      const encrypted = encryptSecret('', TEST_KEY);
      expect(decryptSecret(encrypted, TEST_KEY)).toBe('');
    });
  });

  describe('ciphertext properties', () => {
    it('never stores the plaintext in the encrypted output', () => {
      const plaintext = 'sk-super-secret-value-12345';
      const encrypted = encryptSecret(plaintext, TEST_KEY);

      expect(encrypted).not.toContain(plaintext);
    });

    it('produces a different ciphertext each time, even for the same plaintext (random IV)', () => {
      const plaintext = 'sk-same-key-every-time';
      const first = encryptSecret(plaintext, TEST_KEY);
      const second = encryptSecret(plaintext, TEST_KEY);

      expect(first).not.toBe(second);
      // ...but both still decrypt to the same original value
      expect(decryptSecret(first, TEST_KEY)).toBe(plaintext);
      expect(decryptSecret(second, TEST_KEY)).toBe(plaintext);
    });

    it('encodes as iv:authTag:ciphertext, three base64 segments', () => {
      const encrypted = encryptSecret('sk-anything', TEST_KEY);
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
    });
  });

  describe('tamper detection (GCM auth tag)', () => {
    it('throws if the ciphertext is modified after encryption', () => {
      const encrypted = encryptSecret('sk-do-not-tamper', TEST_KEY);
      const [iv, authTag, ciphertext] = encrypted.split(':');

      // Flip the ciphertext to simulate tampering / bit-rot in storage.
      const tamperedBuffer = Buffer.from(ciphertext, 'base64');
      tamperedBuffer[0] ^= 0xff;
      const tampered = [iv, authTag, tamperedBuffer.toString('base64')].join(
        ':',
      );

      expect(() => decryptSecret(tampered, TEST_KEY)).toThrow();
    });

    it('throws if the auth tag is modified', () => {
      const encrypted = encryptSecret('sk-do-not-tamper', TEST_KEY);
      const [iv, authTag, ciphertext] = encrypted.split(':');

      const tamperedTag = Buffer.from(authTag, 'base64');
      tamperedTag[0] ^= 0xff;
      const tampered = [iv, tamperedTag.toString('base64'), ciphertext].join(
        ':',
      );

      expect(() => decryptSecret(tampered, TEST_KEY)).toThrow();
    });

    it('throws when decrypting with the wrong key', () => {
      const encrypted = encryptSecret('sk-encrypted-with-test-key', TEST_KEY);

      expect(() => decryptSecret(encrypted, OTHER_KEY)).toThrow();
    });

    it('throws on a malformed encoded value', () => {
      expect(() => decryptSecret('not-the-right-format', TEST_KEY)).toThrow(
        'Malformed encrypted value',
      );
    });
  });

  describe('key validation', () => {
    it('rejects a key that is not 32 bytes when decoded', () => {
      const shortKey = Buffer.from('too-short').toString('base64');
      expect(() => encryptSecret('sk-anything', shortKey)).toThrow(
        InvalidEncryptionKeyError,
      );
    });
  });
});
