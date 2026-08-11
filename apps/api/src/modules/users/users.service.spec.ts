import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { DbService } from '../../common/db/db.service';
import { EncryptionService } from '../../common/crypto/encryption.service';

type MockUser = { planApprovalMode?: string; modelKey?: string; encryptedApiKey?: string | null };

/**
 * Mimics Drizzle's fluent query builder (`.select().from().where().limit()`
 * and `.insert().values().onConflictDoUpdate().returning()`) closely enough
 * to exercise UsersService without a real Postgres connection. `valuesMock`/
 * `onConflictDoUpdateMock` are exposed so tests can assert on exactly what
 * was passed to insert/upsert, the same way the old Prisma mock exposed
 * `user.upsert`'s call args.
 */
function makeDbMock(existingUser: MockUser | null = null) {
    const selectResult = existingUser ? [existingUser] : [];
    const limitMock = jest.fn().mockResolvedValue(selectResult);
    const whereMock = jest.fn().mockReturnValue({ limit: limitMock });
    const fromMock = jest.fn().mockReturnValue({ where: whereMock });
    const selectMock = jest.fn().mockReturnValue({ from: fromMock });

    const onConflictDoUpdateMock = jest.fn();
    const valuesMock = jest.fn((insertValues: Record<string, unknown>) => ({
        onConflictDoUpdate: onConflictDoUpdateMock.mockImplementation(({ set }: { set: Record<string, unknown> }) => ({
            returning: jest.fn().mockResolvedValue([
                existingUser ? { ...existingUser, ...set } : { ...insertValues, ...set },
            ]),
        })),
    }));
    const insertMock = jest.fn().mockReturnValue({ values: valuesMock });

    const dbService = {
        db: { select: selectMock, insert: insertMock },
    } as unknown as DbService;

    return { dbService, valuesMock, onConflictDoUpdateMock };
}

/**
 * Deterministic fake — the real AES-GCM round-trip is already covered by
 * byok-encryption.spec.ts. Hex-encodes rather than wrapping the plaintext
 * literally, so it actually looks like ciphertext (doesn't contain the
 * plaintext as a substring) — that property is what some tests below assert.
 */
function makeEncryptionServiceMock() {
    return {
        encrypt: jest.fn((plaintext: string) => `enc:${Buffer.from(plaintext, 'utf-8').toString('hex')}`),
        decrypt: jest.fn((ciphertext: string) => Buffer.from(ciphertext.replace(/^enc:/, ''), 'hex').toString('utf-8')),
    } as unknown as EncryptionService;
}

describe('UsersService', () => {
    let encryptionService: EncryptionService;

    beforeEach(() => {
        encryptionService = makeEncryptionServiceMock();
    });

    describe('getSettings()', () => {
        it('returns defaults (MANUAL_REVIEW + openrouter:nemotron-nano-12b-v2-vl-free + no key) when the user does not exist yet', async () => {
            const { dbService } = makeDbMock(null);
            const service = new UsersService(dbService, encryptionService);

            const settings = await service.getSettings('new-user');

            expect(settings).toEqual({
                planApprovalMode: 'MANUAL_REVIEW',
                modelKey: 'openrouter:nemotron-nano-12b-v2-vl-free',
                hasApiKey: false,
            });
        });

        it('returns the stored values when the user already has settings', async () => {
            const { dbService } = makeDbMock({ planApprovalMode: 'AUTO_APPROVE', modelKey: 'openai:gpt-4o' });
            const service = new UsersService(dbService, encryptionService);

            const settings = await service.getSettings('existing-user');

            expect(settings).toEqual({
                planApprovalMode: 'AUTO_APPROVE',
                modelKey: 'openai:gpt-4o',
                hasApiKey: false,
            });
        });

        it('reports hasApiKey=true but never returns the encrypted value itself', async () => {
            const { dbService } = makeDbMock({
                planApprovalMode: 'MANUAL_REVIEW',
                modelKey: 'openrouter:nemotron-nano-12b-v2-vl-free',
                encryptedApiKey: 'encrypted(sk-real-secret-value)',
            });
            const service = new UsersService(dbService, encryptionService);

            const settings = await service.getSettings('existing-user');

            expect(settings.hasApiKey).toBe(true);
            expect(JSON.stringify(settings)).not.toContain('sk-real-secret-value');
            expect(JSON.stringify(settings)).not.toContain('encryptedApiKey');
        });
    });

    describe('updateSettings()', () => {
        it('creates a user with defaults for any field not supplied', async () => {
            const { dbService, valuesMock } = makeDbMock(null);
            const service = new UsersService(dbService, encryptionService);

            await service.updateSettings('new-user', { planApprovalMode: 'AUTO_APPROVE' });

            expect(valuesMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    clerkId: 'new-user',
                    planApprovalMode: 'AUTO_APPROVE',
                    modelKey: 'openrouter:nemotron-nano-12b-v2-vl-free', // untouched field defaults, doesn't come back as undefined
                }),
            );
        });

        it('updates only the field actually provided, leaving the others untouched', async () => {
            const { dbService, onConflictDoUpdateMock } = makeDbMock({ planApprovalMode: 'MANUAL_REVIEW', modelKey: 'openrouter:nemotron-nano-12b-v2-vl-free' });
            const service = new UsersService(dbService, encryptionService);

            await service.updateSettings('existing-user', { modelKey: 'anthropic:claude-3-5-sonnet' });

            const setArgs = onConflictDoUpdateMock.mock.calls[0][0].set;
            expect(setArgs).toEqual({ modelKey: 'anthropic:claude-3-5-sonnet', updatedAt: expect.any(Date) });
        });

        it('rejects an unrecognised modelKey instead of silently storing a broken preference', async () => {
            const { dbService, valuesMock } = makeDbMock(null);
            const service = new UsersService(dbService, encryptionService);

            await expect(
                service.updateSettings('some-user', { modelKey: 'made-up-provider:not-a-model' }),
            ).rejects.toThrow(BadRequestException);
            expect(valuesMock).not.toHaveBeenCalled();
        });

        describe('BYOK key handling', () => {
            it('encrypts a supplied apiKey before it ever reaches the database', async () => {
                const { dbService, valuesMock } = makeDbMock(null);
                const service = new UsersService(dbService, encryptionService);

                await service.updateSettings('some-user', { apiKey: 'sk-my-real-groq-key' });

                expect(encryptionService.encrypt).toHaveBeenCalledWith('sk-my-real-groq-key');

                const insertArgs = valuesMock.mock.calls[0][0];
                // The plaintext must never appear anywhere in the insert call args.
                expect(JSON.stringify(insertArgs)).not.toContain('sk-my-real-groq-key');
                expect(insertArgs.encryptedApiKey).toBe('enc:736b2d6d792d7265616c2d67726f712d6b6579');
            });

            it('never returns the plaintext or ciphertext from updateSettings — only hasApiKey', async () => {
                const { dbService } = makeDbMock(null);
                const service = new UsersService(dbService, encryptionService);

                const result = await service.updateSettings('some-user', { apiKey: 'sk-my-real-groq-key' });

                expect(result).toEqual({
                    planApprovalMode: 'MANUAL_REVIEW',
                    modelKey: 'openrouter:nemotron-nano-12b-v2-vl-free',
                    updatedAt: expect.any(Date),
                    hasApiKey: true,
                });
            });

            it('clears a saved key when apiKey is an empty string', async () => {
                const { dbService, onConflictDoUpdateMock } = makeDbMock({
                    planApprovalMode: 'MANUAL_REVIEW',
                    modelKey: 'openrouter:nemotron-nano-12b-v2-vl-free',
                    encryptedApiKey: 'encrypted(sk-old-key)',
                });
                const service = new UsersService(dbService, encryptionService);

                const result = await service.updateSettings('existing-user', { apiKey: '' });

                const setArgs = onConflictDoUpdateMock.mock.calls[0][0].set;
                expect(setArgs.encryptedApiKey).toBeNull();
                expect(result.hasApiKey).toBe(false);
                expect(encryptionService.encrypt).not.toHaveBeenCalled();
            });

            it('leaves a saved key untouched when apiKey is omitted entirely', async () => {
                const { dbService, onConflictDoUpdateMock } = makeDbMock({
                    planApprovalMode: 'MANUAL_REVIEW',
                    modelKey: 'openrouter:nemotron-nano-12b-v2-vl-free',
                    encryptedApiKey: 'encrypted(sk-old-key)',
                });
                const service = new UsersService(dbService, encryptionService);

                await service.updateSettings('existing-user', { planApprovalMode: 'AUTO_APPROVE' });

                const setArgs = onConflictDoUpdateMock.mock.calls[0][0].set;
                expect(setArgs.encryptedApiKey).toBeUndefined();
                expect(encryptionService.encrypt).not.toHaveBeenCalled();
            });
        });
    });

    describe('getDecryptedApiKey()', () => {
        it('returns undefined when the user has no saved key', async () => {
            const { dbService } = makeDbMock({ encryptedApiKey: null });
            const service = new UsersService(dbService, encryptionService);

            expect(await service.getDecryptedApiKey('some-user')).toBeUndefined();
            expect(encryptionService.decrypt).not.toHaveBeenCalled();
        });

        it('returns undefined when the user does not exist', async () => {
            const { dbService } = makeDbMock(null);
            const service = new UsersService(dbService, encryptionService);

            expect(await service.getDecryptedApiKey('no-such-user')).toBeUndefined();
        });

        it('decrypts and returns the plaintext key when one is saved', async () => {
            const { dbService } = makeDbMock({ encryptedApiKey: 'enc:736b2d7468652d7265616c2d6b6579' });
            const service = new UsersService(dbService, encryptionService);

            const key = await service.getDecryptedApiKey('some-user');

            expect(encryptionService.decrypt).toHaveBeenCalledWith('enc:736b2d7468652d7265616c2d6b6579');
            expect(key).toBe('sk-the-real-key');
        });
    });
});
