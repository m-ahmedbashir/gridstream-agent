import { MatchingService } from './matching.service';
import type { MachineProfile, Measure } from '@maintain/shared';

describe('MatchingService', () => {
    let service: MatchingService;
    let prismaMock: any;

    beforeEach(() => {
        prismaMock = {
            measure: { findMany: jest.fn() },
        };
        service = new MatchingService(prismaMock);
    });

    it('returns measures that match the machine type', async () => {
        const measures: Measure[] = [
            {
                id: 'm1',
                category: 'predictive',
                title: 'CNC monitoring',
                titleDe: 'CNC Überwachung',
                description: '',
                applicableMachineTypes: ['CNC'],
                typicalInvestment: 1000,
                typicalAnnualSavings: 2000,
                paybackMonths: 6,
                tasks: [],
            },
            {
                id: 'm2',
                category: 'energy',
                title: 'LED retrofit',
                titleDe: 'LED-Umrüstung',
                description: '',
                applicableMachineTypes: ['HVAC', 'CNC'],
                typicalInvestment: 1000,
                typicalAnnualSavings: 2000,
                paybackMonths: 12,
                tasks: [],
            },
            {
                id: 'm3',
                category: 'efficiency',
                title: 'Compressor oil',
                titleDe: 'Ölwechsel Kompressor',
                description: '',
                applicableMachineTypes: ['Compressor'],
                typicalInvestment: 1000,
                typicalAnnualSavings: 2000,
                paybackMonths: 6,
                tasks: [],
            },
        ];

        prismaMock.measure.findMany.mockResolvedValue(measures);

        const profile: MachineProfile = {
            machineId: 'CNC-001',
            machineType: 'CNC',
            manufacturer: 'DMG',
            yearInstalled: 2020,
            runtimeHours: 15000,
            observedIssues: [],
            criticality: 'high',
        };

        const result = await service.findMeasures(profile);

        expect(result).toHaveLength(2);
        expect(result.map((m) => m.id)).toEqual(['m1', 'm2']);
    });

    it('filters out measures whose minRuntimeHours exceed the profile runtime', async () => {
        const measures: Measure[] = [
            {
                id: 'm1',
                category: 'predictive',
                title: 'CNC monitoring',
                titleDe: 'CNC Überwachung',
                description: '',
                applicableMachineTypes: ['CNC'],
                minRuntimeHours: 10000,
                typicalInvestment: 1000,
                typicalAnnualSavings: 2000,
                paybackMonths: 6,
                tasks: [],
            },
            {
                id: 'm2',
                category: 'predictive',
                title: 'CNC advanced',
                titleDe: 'CNC erweitert',
                description: '',
                applicableMachineTypes: ['CNC'],
                minRuntimeHours: 20000,
                typicalInvestment: 1000,
                typicalAnnualSavings: 2000,
                paybackMonths: 12,
                tasks: [],
            },
        ];

        prismaMock.measure.findMany.mockResolvedValue(measures);

        const profile: MachineProfile = {
            machineId: 'CNC-001',
            machineType: 'CNC',
            manufacturer: 'DMG',
            yearInstalled: 2020,
            runtimeHours: 15000,
            observedIssues: [],
            criticality: 'high',
        };

        const result = await service.findMeasures(profile);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('m1');
    });

    it('sorts results by paybackMonths ascending and limits to top 5', async () => {
        const measures: Measure[] = Array.from({ length: 7 }, (_, i) => ({
            id: `m${i + 1}`,
            category: 'efficiency',
            title: `Measure ${i + 1}`,
            titleDe: `Maßnahme ${i + 1}`,
            description: '',
            applicableMachineTypes: ['CNC'],
            typicalInvestment: 1000,
            typicalAnnualSavings: 2000,
            paybackMonths: 10 - i,
            tasks: [],
        }));

        prismaMock.measure.findMany.mockResolvedValue(measures);

        const profile: MachineProfile = {
            machineId: 'CNC-001',
            machineType: 'CNC',
            manufacturer: 'DMG',
            yearInstalled: 2020,
            runtimeHours: 15000,
            observedIssues: [],
            criticality: 'high',
        };

        const result = await service.findMeasures(profile);

        expect(result).toHaveLength(5);
        expect(result[0].paybackMonths).toBe(4);
        expect(result[4].paybackMonths).toBe(8);
    });
});
