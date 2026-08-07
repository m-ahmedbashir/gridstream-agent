import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import {
  DEFAULT_MODEL_KEY,
  DEFAULT_PROCESSING_MODE,
  MODEL_REGISTRY,
  PROCESSING_MODES,
  isProcessingMode,
  type ModelKey,
} from '../extraction/model-registry';

export interface SettingsUpdate {
  extractionMode?: string;
  modelKey?: string;
  /** How images/scanned PDFs get read: 'vision' or 'local-ocr'. */
  processingMode?: string;
  /**
   * A plaintext API key to save (BYOK), encrypted before it ever reaches the
   * database. Pass an empty string to remove a previously-saved key.
   * Never returned back to the caller — see getSettings().
   */
  apiKey?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Public-facing settings read. Deliberately never selects or returns
   * `encryptedApiKey` — only whether one is saved, via `hasApiKey`. A user's
   * key is write-only from the API's perspective once saved.
   */
  async getSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId: userId },
      select: { extractionMode: true, modelKey: true, processingMode: true, encryptedApiKey: true },
    });

    return {
      extractionMode: user?.extractionMode || 'MANUAL_REVIEW',
      modelKey: user?.modelKey || DEFAULT_MODEL_KEY,
      processingMode: user?.processingMode || DEFAULT_PROCESSING_MODE,
      hasApiKey: Boolean(user?.encryptedApiKey),
    };
  }

  async updateSettings(userId: string, updates: SettingsUpdate) {
    if (updates.modelKey && !(updates.modelKey in MODEL_REGISTRY)) {
      throw new BadRequestException(
        `Unknown modelKey "${updates.modelKey}". Valid keys: ${Object.keys(MODEL_REGISTRY).join(', ')}`,
      );
    }
    if (updates.processingMode && !isProcessingMode(updates.processingMode)) {
      throw new BadRequestException(
        `Unknown processingMode "${updates.processingMode}". Valid values: ${PROCESSING_MODES.join(', ')}`,
      );
    }

    // '' clears a saved key; undefined leaves it untouched; anything else gets encrypted.
    const encryptedApiKey = updates.apiKey === undefined
      ? undefined
      : updates.apiKey === ''
        ? null
        : this.encryptionService.encrypt(updates.apiKey);

    // Create user if doesn't exist, then update — only touching the fields actually
    // provided, so changing one setting never silently resets the others to a default.
    const user = await this.prisma.user.upsert({
      where: { clerkId: userId },
      create: {
        clerkId: userId,
        extractionMode: updates.extractionMode ?? 'MANUAL_REVIEW',
        modelKey: (updates.modelKey as ModelKey) ?? DEFAULT_MODEL_KEY,
        processingMode: updates.processingMode ?? DEFAULT_PROCESSING_MODE,
        ...(encryptedApiKey !== undefined && { encryptedApiKey }),
      },
      update: {
        ...(updates.extractionMode !== undefined && { extractionMode: updates.extractionMode }),
        ...(updates.modelKey !== undefined && { modelKey: updates.modelKey }),
        ...(updates.processingMode !== undefined && { processingMode: updates.processingMode }),
        ...(encryptedApiKey !== undefined && { encryptedApiKey }),
      },
      select: { extractionMode: true, modelKey: true, processingMode: true, updatedAt: true, encryptedApiKey: true },
    });

    // Never let the encrypted value (let alone a plaintext one) leave this method.
    return {
      extractionMode: user.extractionMode,
      modelKey: user.modelKey,
      processingMode: user.processingMode,
      updatedAt: user.updatedAt,
      hasApiKey: Boolean(user.encryptedApiKey),
    };
  }

  /**
   * Internal-only: decrypts the caller's saved API key for immediate use in
   * an extraction request. Never exposed over HTTP — only ExtractionController
   * calls this, and only to hand the plaintext straight to the provider SDK.
   * Returns undefined (not an error) when the user has no key saved, so
   * callers can fall back to the app's shared key.
   */
  async getDecryptedApiKey(userId: string): Promise<string | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { clerkId: userId },
      select: { encryptedApiKey: true },
    });

    if (!user?.encryptedApiKey) {
      return undefined;
    }

    return this.encryptionService.decrypt(user.encryptedApiKey);
  }
}
