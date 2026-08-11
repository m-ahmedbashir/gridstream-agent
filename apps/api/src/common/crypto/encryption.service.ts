import { Injectable } from '@nestjs/common';
import { encryptSecret, decryptSecret } from './byok-encryption';

/**
 * Thin DI wrapper around the pure encryption functions — reads the real
 * secret from `BYOK_ENCRYPTION_KEY` once at construction (fail fast if it's
 * missing or the wrong length, rather than failing later when a user first
 * tries to save a key) and never logs or exposes it.
 */
@Injectable()
export class EncryptionService {
    private readonly key: string;

    constructor() {
        const key = process.env.BYOK_ENCRYPTION_KEY;
        if (!key) {
            throw new Error(
                'BYOK_ENCRYPTION_KEY is not set. Required to encrypt/decrypt user-supplied provider API keys — see .env.example.',
            );
        }
        this.key = key;
    }

    encrypt(plaintext: string): string {
        return encryptSecret(plaintext, this.key);
    }

    decrypt(ciphertext: string): string {
        return decryptSecret(ciphertext, this.key);
    }
}
