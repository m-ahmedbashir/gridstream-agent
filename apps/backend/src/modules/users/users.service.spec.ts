import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../common/prisma/prisma.service';

function makePrismaMock(existingUser: { extractionMode?: string; modelKey?: string } | null = null) {
    return {
        user: {
            findUnique: jest.fn().mockResolvedValue(existingUser),
            upsert: jest.fn().mockImplementation(({ create, update }) =>
                Promise.resolve({
                    extractionMode: update.extractionMode ?? create.extractionMode,
                    modelKey: update.modelKey ?? create.modelKey,
                    updatedAt: new Date(),
                }),
            ),
        },
    } as unknown as PrismaService;
}

describe('UsersService', () => {
    describe('getSettings()', () => {
        it('returns defaults (MANUAL_REVIEW + groq:llama-4-scout) when the user does not exist yet', async () => {
            const prisma = makePrismaMock(null);
            const service = new UsersService(prisma);

            const settings = await service.getSettings('new-user');

            expect(settings).toEqual({
                extractionMode: 'MANUAL_REVIEW',
                modelKey: 'groq:llama-4-scout',
            });
        });

        it('returns the stored values when the user already has settings', async () => {
            const prisma = makePrismaMock({ extractionMode: 'AUTO_APPROVE', modelKey: 'openai:gpt-4o' });
            const service = new UsersService(prisma);

            const settings = await service.getSettings('existing-user');

            expect(settings).toEqual({
                extractionMode: 'AUTO_APPROVE',
                modelKey: 'openai:gpt-4o',
            });
        });
    });

    describe('updateSettings()', () => {
        it('creates a user with defaults for any field not supplied', async () => {
            const prisma = makePrismaMock(null);
            const service = new UsersService(prisma);

            await service.updateSettings('new-user', { extractionMode: 'AUTO_APPROVE' });

            expect(prisma.user.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({
                        extractionMode: 'AUTO_APPROVE',
                        modelKey: 'groq:llama-4-scout', // untouched field defaults, doesn't come back as undefined
                    }),
                }),
            );
        });

        it('updates only the field actually provided, leaving the other untouched', async () => {
            const prisma = makePrismaMock({ extractionMode: 'MANUAL_REVIEW', modelKey: 'groq:llama-4-scout' });
            const service = new UsersService(prisma);

            await service.updateSettings('existing-user', { modelKey: 'anthropic:claude-3-5-sonnet' });

            const upsertArgs = (prisma.user.upsert as jest.Mock).mock.calls[0][0];
            expect(upsertArgs.update).toEqual({ modelKey: 'anthropic:claude-3-5-sonnet' });
            expect(upsertArgs.update.extractionMode).toBeUndefined();
        });

        it('rejects an unrecognised modelKey instead of silently storing a broken preference', async () => {
            const prisma = makePrismaMock(null);
            const service = new UsersService(prisma);

            await expect(
                service.updateSettings('some-user', { modelKey: 'made-up-provider:not-a-model' }),
            ).rejects.toThrow(BadRequestException);
            expect(prisma.user.upsert).not.toHaveBeenCalled();
        });
    });
});
