import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';

type MockUser = { planApprovalMode?: string; modelKey?: string; processingMode?: string; encryptedApiKey?: string | null };

function makePrismaMock(existingUser: MockUser | null = null) {
    return {
        user: {
            findUnique: jest.fn().mockResolvedValue(existingUser),
            upsert: jest.fn().mockImplementation(({ create, update }) =>
                Promise.resolve({
                    planApprovalMode: update.planApprovalMode ?? create.planApprovalMode,
                    modelKey: update.modelKey ?? create.modelKey,
                    processingMode: update.processingMode ?? create.processingMode,
                    encryptedApiKey: 'encryptedApiKey' in update ? update.encryptedApiKey : create.encryptedApiKey ?? null,
                    updatedAt: new Date(),
                }),
            ),
        },
    } as unknown as PrismaService;
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
        it('returns defaults (MANUAL_REVIEW + groq:llama-4-scout + vision + no key) when the user does not exist yet', async () => {
            const prisma = makePrismaMock(null);
            const service = new UsersService(prisma, encryptionService);

            const settings = await service.getSettings('new-user');

            expect(settings).toEqual({
                planApprovalMode: 'MANUAL_REVIEW',
                modelKey: 'groq:llama-4-scout',
                processingMode: 'vision',
                hasApiKey: false,
            });
        });

        it('returns the stored values when the user already has settings', async () => {
            const prisma = makePrismaMock({ planApprovalMode: 'AUTO_APPROVE', modelKey: 'openai:gpt-4o', processingMode: 'vision' });
            const service = new UsersService(prisma, encryptionService);

            const settings = await service.getSettings('existing-user');

            expect(settings).toEqual({
                planApprovalMode: 'AUTO_APPROVE',
                modelKey: 'openai:gpt-4o',
                processingMode: 'vision',
                hasApiKey: false,
            });
        });

        it('reports hasApiKey=true but never returns the encrypted value itself', async () => {
            const prisma = makePrismaMock({
                planApprovalMode: 'MANUAL_REVIEW',
                modelKey: 'groq:llama-4-scout',
                processingMode: 'vision',
                encryptedApiKey: 'encrypted(sk-real-secret-value)',
            });
            const service = new UsersService(prisma, encryptionService);

            const settings = await service.getSettings('existing-user');

            expect(settings.hasApiKey).toBe(true);
            expect(JSON.stringify(settings)).not.toContain('sk-real-secret-value');
            expect(JSON.stringify(settings)).not.toContain('encryptedApiKey');
        });
    });

    describe('updateSettings()', () => {
        it('creates a user with defaults for any field not supplied', async () => {
            const prisma = makePrismaMock(null);
            const service = new UsersService(prisma, encryptionService);

            await service.updateSettings('new-user', { planApprovalMode: 'AUTO_APPROVE' });

            expect(prisma.user.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({
                        planApprovalMode: 'AUTO_APPROVE',
                        modelKey: 'groq:llama-4-scout', // untouched field defaults, doesn't come back as undefined
                        processingMode: 'vision',
                    }),
                }),
            );
        });

        it('updates only the field actually provided, leaving the others untouched', async () => {
            const prisma = makePrismaMock({ planApprovalMode: 'MANUAL_REVIEW', modelKey: 'groq:llama-4-scout', processingMode: 'vision' });
            const service = new UsersService(prisma, encryptionService);

            await service.updateSettings('existing-user', { modelKey: 'anthropic:claude-3-5-sonnet' });

            const upsertArgs = (prisma.user.upsert as jest.Mock).mock.calls[0][0];
            expect(upsertArgs.update).toEqual({ modelKey: 'anthropic:claude-3-5-sonnet' });
            expect(upsertArgs.update.planApprovalMode).toBeUndefined();
            expect(upsertArgs.update.processingMode).toBeUndefined();
            expect(upsertArgs.update.encryptedApiKey).toBeUndefined();
        });

        it('rejects an unrecognised modelKey instead of silently storing a broken preference', async () => {
            const prisma = makePrismaMock(null);
            const service = new UsersService(prisma, encryptionService);

            await expect(
                service.updateSettings('some-user', { modelKey: 'made-up-provider:not-a-model' }),
            ).rejects.toThrow(BadRequestException);
            expect(prisma.user.upsert).not.toHaveBeenCalled();
        });

        describe('BYOK key handling', () => {
            it('encrypts a supplied apiKey before it ever reaches Prisma', async () => {
                const prisma = makePrismaMock(null);
                const service = new UsersService(prisma, encryptionService);

                await service.updateSettings('some-user', { apiKey: 'sk-my-real-groq-key' });

                expect(encryptionService.encrypt).toHaveBeenCalledWith('sk-my-real-groq-key');

                const upsertArgs = (prisma.user.upsert as jest.Mock).mock.calls[0][0];
                // The plaintext must never appear anywhere in the Prisma call args.
                expect(JSON.stringify(upsertArgs)).not.toContain('sk-my-real-groq-key');
                expect(upsertArgs.create.encryptedApiKey).toBe('enc:736b2d6d792d7265616c2d67726f712d6b6579');
            });

            it('never returns the plaintext or ciphertext from updateSettings — only hasApiKey', async () => {
                const prisma = makePrismaMock(null);
                const service = new UsersService(prisma, encryptionService);

                const result = await service.updateSettings('some-user', { apiKey: 'sk-my-real-groq-key' });

                expect(result).toEqual({
                    planApprovalMode: 'MANUAL_REVIEW',
                    modelKey: 'groq:llama-4-scout',
                    processingMode: 'vision',
                    updatedAt: expect.any(Date),
                    hasApiKey: true,
                });
            });

            it('clears a saved key when apiKey is an empty string', async () => {
                const prisma = makePrismaMock({
                    planApprovalMode: 'MANUAL_REVIEW',
                    modelKey: 'groq:llama-4-scout',
                    encryptedApiKey: 'encrypted(sk-old-key)',
                });
                const service = new UsersService(prisma, encryptionService);

                const result = await service.updateSettings('existing-user', { apiKey: '' });

                const upsertArgs = (prisma.user.upsert as jest.Mock).mock.calls[0][0];
                expect(upsertArgs.update.encryptedApiKey).toBeNull();
                expect(result.hasApiKey).toBe(false);
                expect(encryptionService.encrypt).not.toHaveBeenCalled();
            });

            it('leaves a saved key untouched when apiKey is omitted entirely', async () => {
                const prisma = makePrismaMock({
                    planApprovalMode: 'MANUAL_REVIEW',
                    modelKey: 'groq:llama-4-scout',
                    encryptedApiKey: 'encrypted(sk-old-key)',
                });
                const service = new UsersService(prisma, encryptionService);

                await service.updateSettings('existing-user', { planApprovalMode: 'AUTO_APPROVE' });

                const upsertArgs = (prisma.user.upsert as jest.Mock).mock.calls[0][0];
                expect(upsertArgs.update.encryptedApiKey).toBeUndefined();
                expect(encryptionService.encrypt).not.toHaveBeenCalled();
            });
        });
    });

    describe('getDecryptedApiKey()', () => {
        it('returns undefined when the user has no saved key', async () => {
            const prisma = makePrismaMock({ encryptedApiKey: null });
            const service = new UsersService(prisma, encryptionService);

            expect(await service.getDecryptedApiKey('some-user')).toBeUndefined();
            expect(encryptionService.decrypt).not.toHaveBeenCalled();
        });

        it('returns undefined when the user does not exist', async () => {
            const prisma = makePrismaMock(null);
            const service = new UsersService(prisma, encryptionService);

            expect(await service.getDecryptedApiKey('no-such-user')).toBeUndefined();
        });

        it('decrypts and returns the plaintext key when one is saved', async () => {
            const prisma = makePrismaMock({ encryptedApiKey: 'enc:736b2d7468652d7265616c2d6b6579' });
            const service = new UsersService(prisma, encryptionService);

            const key = await service.getDecryptedApiKey('some-user');

            expect(encryptionService.decrypt).toHaveBeenCalledWith('enc:736b2d7468652d7265616c2d6b6579');
            expect(key).toBe('sk-the-real-key');
        });
    });
});
