import { NotFoundException } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import type { RawFeedMessage } from './thingspeak-demo-feed.service';

describe('TelemetryService', () => {
    let service: TelemetryService;
    let prismaMock: any;
    let feedMock: { fetchRecent: jest.Mock };

    const profile = { id: 'profile-1', machineType: 'CNC', observedIssues: [] as string[] };

    beforeEach(() => {
        prismaMock = {
            machineProfile: {
                findUnique: jest.fn().mockResolvedValue(profile),
                update: jest.fn().mockResolvedValue(profile),
            },
            machineReading: {
                createMany: jest.fn().mockResolvedValue({ count: 0 }),
                findMany: jest.fn().mockResolvedValue([]),
            },
        };
        feedMock = { fetchRecent: jest.fn().mockResolvedValue([]) };
        service = new TelemetryService(prismaMock, feedMock as any);
    });

    it('throws NotFoundException when the machine profile does not exist', async () => {
        prismaMock.machineProfile.findUnique.mockResolvedValue(null);

        await expect(service.getSnapshot('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns a normal status with no suggested issues when readings sit near baseline', async () => {
        const readings = [
            { id: 'r1', metric: 'temperature', value: 55, unit: '°C', recordedAt: new Date('2026-08-10T10:00:00Z') },
        ];
        prismaMock.machineReading.findMany.mockResolvedValue(readings);

        const snapshot = await service.getSnapshot('profile-1');

        expect(snapshot.status).toBe('normal');
        expect(snapshot.suggestedIssues).toEqual([]);
        expect(snapshot.isSimulated).toBe(true);
        expect(snapshot.baseline).toBe(55); // CNC baseline
    });

    it('flags critical status and a suggested issue when the latest reading is far above baseline', async () => {
        const readings = [
            { id: 'r1', metric: 'temperature', value: 80, unit: '°C', recordedAt: new Date('2026-08-10T10:00:00Z') },
        ];
        prismaMock.machineReading.findMany.mockResolvedValue(readings);

        const snapshot = await service.getSnapshot('profile-1');

        expect(snapshot.status).toBe('critical');
        expect(snapshot.suggestedIssues).toHaveLength(1);
        expect(snapshot.suggestedIssues[0]).toMatch(/Critically elevated/);
        expect(prismaMock.machineProfile.update).toHaveBeenCalledWith({
            where: { id: 'profile-1' },
            data: { observedIssues: [snapshot.suggestedIssues[0]] },
        });
    });

    it('does not re-append a suggested issue already present on the profile', async () => {
        const stableIssue = 'Critically elevated operating temperature detected via live monitoring — inspect cooling/lubrication.';
        prismaMock.machineProfile.findUnique.mockResolvedValue({ ...profile, observedIssues: [stableIssue] });
        prismaMock.machineReading.findMany.mockResolvedValue([
            { id: 'r1', metric: 'temperature', value: 80, unit: '°C', recordedAt: new Date('2026-08-10T10:00:00Z') },
        ]);

        await service.getSnapshot('profile-1');

        expect(prismaMock.machineProfile.update).not.toHaveBeenCalled();
    });

    it('persists normalized readings derived from the raw feed, deduped via skipDuplicates', async () => {
        const raw: RawFeedMessage[] = [{ externalId: 'tt-1', timestamp: 1723282800000, rawValue: 25 }];
        feedMock.fetchRecent.mockResolvedValue(raw);

        await service.getSnapshot('profile-1');

        expect(prismaMock.machineReading.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: [
                    expect.objectContaining({ machineProfileId: 'profile-1', externalId: 'tt-1', metric: 'temperature' }),
                ],
                skipDuplicates: true,
            }),
        );
    });

    it('never throws when the feed and persistence both fail', async () => {
        feedMock.fetchRecent.mockResolvedValue([{ externalId: 'tt-1', timestamp: Date.now(), rawValue: 25 }]);
        prismaMock.machineReading.createMany.mockRejectedValue(new Error('db unavailable'));
        prismaMock.machineReading.findMany.mockResolvedValue([]);

        await expect(service.getSnapshot('profile-1')).resolves.toBeDefined();
    });
});
