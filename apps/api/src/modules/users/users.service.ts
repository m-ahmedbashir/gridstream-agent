import { BadRequestException, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../common/db/db.service';
import { users } from '@gridstream/shared';
import { EncryptionService } from '../../common/crypto/encryption.service';
import {
  DEFAULT_MODEL_KEY,
  MODEL_REGISTRY,
  type ModelKey,
} from '@gridstream/ai-config';

export interface SettingsUpdate {
  planApprovalMode?: string;
  modelKey?: string;
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
    private dbService: DbService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Public-facing settings read. Deliberately never selects or returns
   * `encryptedApiKey` — only whether one is saved, via `hasApiKey`. A user's
   * key is write-only from the API's perspective once saved.
   */
  async getSettings(userId: string) {
    const [user] = await this.dbService.db
      .select({
        planApprovalMode: users.planApprovalMode,
        modelKey: users.modelKey,
        encryptedApiKey: users.encryptedApiKey,
      })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    return {
      planApprovalMode: user?.planApprovalMode || 'MANUAL_REVIEW',
      modelKey: user?.modelKey || DEFAULT_MODEL_KEY,
      hasApiKey: Boolean(user?.encryptedApiKey),
    };
  }

  async updateSettings(userId: string, updates: SettingsUpdate) {
    if (updates.modelKey && !(updates.modelKey in MODEL_REGISTRY)) {
      throw new BadRequestException(
        `Unknown modelKey "${updates.modelKey}". Valid keys: ${Object.keys(MODEL_REGISTRY).join(', ')}`,
      );
    }

    // '' clears a saved key; undefined leaves it untouched; anything else gets encrypted.
    const encryptedApiKey =
      updates.apiKey === undefined
        ? undefined
        : updates.apiKey === ''
          ? null
          : this.encryptionService.encrypt(updates.apiKey);

    // Only touching the fields actually provided, so changing one setting
    // never silently resets the others to a default. `updatedAt` is always
    // stamped explicitly — Drizzle's onConflictDoUpdate needs a non-empty
    // `set`, and this also gives us the same "touched now" semantics Prisma's
    // `@updatedAt` gave us automatically.
    const updateSet: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (updates.planApprovalMode !== undefined)
      updateSet.planApprovalMode = updates.planApprovalMode;
    if (updates.modelKey !== undefined) updateSet.modelKey = updates.modelKey;
    if (encryptedApiKey !== undefined)
      updateSet.encryptedApiKey = encryptedApiKey;

    const [user] = await this.dbService.db
      .insert(users)
      .values({
        clerkId: userId,
        planApprovalMode: updates.planApprovalMode ?? 'MANUAL_REVIEW',
        modelKey: (updates.modelKey as ModelKey) ?? DEFAULT_MODEL_KEY,
        ...(encryptedApiKey !== undefined && { encryptedApiKey }),
      })
      .onConflictDoUpdate({ target: users.clerkId, set: updateSet })
      .returning({
        planApprovalMode: users.planApprovalMode,
        modelKey: users.modelKey,
        updatedAt: users.updatedAt,
        encryptedApiKey: users.encryptedApiKey,
      });

    // Never let the encrypted value (let alone a plaintext one) leave this method.
    return {
      planApprovalMode: user.planApprovalMode,
      modelKey: user.modelKey,
      updatedAt: user.updatedAt,
      hasApiKey: Boolean(user.encryptedApiKey),
    };
  }

  /**
   * Internal-only: decrypts the caller's saved API key for immediate use in
   * an AI request. Never exposed over HTTP — only AI-calling services call
   * this, and only to hand the plaintext straight to the provider SDK.
   * Returns undefined (not an error) when the user has no key saved, so
   * callers can fall back to the app's shared key.
   */
  async getDecryptedApiKey(userId: string): Promise<string | undefined> {
    const [user] = await this.dbService.db
      .select({ encryptedApiKey: users.encryptedApiKey })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (!user?.encryptedApiKey) {
      return undefined;
    }

    return this.encryptionService.decrypt(user.encryptedApiKey);
  }
}
