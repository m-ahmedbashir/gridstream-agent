import { PlanningService } from './planning.service';
import type { MachineProfile, Measure } from '@maintain/shared';

jest.mock('ai', () => ({
    generateObject: jest.fn(),
}));

import { generateObject } from 'ai';

describe('PlanningService', () => {
    let service: PlanningService;
    let prismaMock: any;

    beforeEach(() => {
        prismaMock = {
            user: {
                findUnique: jest.fn().mockResolvedValue({ planApprovalMode: 'MANUAL_REVIEW' }),
            },
            plan: {
                create: jest.fn().mockResolvedValue({ id: 'plan-1' }),
            },
            machineProfile: {
                findUnique: jest.fn().mockResolvedValue({ id: 'profile-1' }),
            },
        };
        service = new PlanningService(prismaMock);
        jest.clearAllMocks();
    });

    function makeProfile(overrides?: Partial<MachineProfile>): MachineProfile {
        return {
            machineId: 'CNC-001',
            machineType: 'CNC',
            manufacturer: 'DMG',
            yearInstalled: 2020,
            runtimeHours: 15000,
            lastServiceDate: null,
            observedIssues: ['Spindel läuft unrund'],
            energyConsumptionKwh: null,
            criticality: 'high',
            location: null,
            ...overrides,
        };
    }

    function makeMeasure(overrides?: Partial<Measure>): Measure {
        return {
            id: 'm1',
            category: 'predictive',
            title: 'Spindle monitoring',
            titleDe: 'Spindelüberwachung',
            description: '',
            applicableMachineTypes: ['CNC'],
            typicalInvestment: 3500,
            typicalAnnualSavings: 12000,
            paybackMonths: 4,
            tasks: [
                { phase: 'Analysis', durationDays: 1, responsibleRole: 'Tech', description: '' },
            ],
            ...overrides,
        };
    }

    it('validates the generated plan against ProjectPlanSchema', async () => {
        (generateObject as jest.Mock).mockResolvedValue({
            object: {
                planId: 'plan-ignored',
                machineId: 'ignored',
                status: 'draft',
                totalInvestment: 0,
                totalAnnualSavings: 0,
                paybackMonths: 0,
                confidence: 0,
                measures: [],
                executiveSummary: 'German summary',
                executiveSummaryEn: 'English summary',
                generatedAt: new Date().toISOString(),
            },
        });

        const profile = makeProfile({ runtimeHours: 5000 });
        const measure = makeMeasure();
        const plan = await service.generatePlan(profile, [measure], 'user-1');

        expect(plan).toMatchObject({
            machineId: 'CNC-001',
            status: 'draft',
            totalInvestment: 3500,
            totalAnnualSavings: 12000,
            paybackMonths: 4,
            executiveSummary: 'German summary',
        });
    });

    it('auto-approves plans under €50k with confidence >= 0.8 when user mode is AUTO_APPROVE', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ planApprovalMode: 'AUTO_APPROVE' });

        (generateObject as jest.Mock).mockResolvedValue({
            object: {
                planId: 'plan-ignored',
                machineId: 'ignored',
                status: 'draft',
                totalInvestment: 0,
                totalAnnualSavings: 0,
                paybackMonths: 0,
                confidence: 0,
                measures: [],
                executiveSummary: 'German summary',
                generatedAt: new Date().toISOString(),
            },
        });

        const profile = makeProfile({ runtimeHours: 25000, observedIssues: ['Issue 1', 'Issue 2'] });
        const measure = makeMeasure();
        const plan = await service.generatePlan(profile, [measure], 'user-1');

        expect(plan.status).toBe('approved');
        expect(plan.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('keeps plan as draft when totalInvestment exceeds €50k', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ planApprovalMode: 'AUTO_APPROVE' });

        (generateObject as jest.Mock).mockResolvedValue({
            object: {
                planId: 'plan-ignored',
                machineId: 'ignored',
                status: 'draft',
                totalInvestment: 0,
                totalAnnualSavings: 0,
                paybackMonths: 0,
                confidence: 0,
                measures: [],
                executiveSummary: 'German summary',
                generatedAt: new Date().toISOString(),
            },
        });

        const profile = makeProfile({ runtimeHours: 25000 });
        const measures = [
            makeMeasure({ id: 'm1', typicalInvestment: 30000 }),
            makeMeasure({ id: 'm2', typicalInvestment: 30000 }),
        ];
        const plan = await service.generatePlan(profile, measures, 'user-1');

        expect(plan.status).toBe('draft');
    });

    it('scales investment and savings for high runtime machines', async () => {
        (generateObject as jest.Mock).mockResolvedValue({
            object: {
                planId: 'plan-ignored',
                machineId: 'ignored',
                status: 'draft',
                totalInvestment: 0,
                totalAnnualSavings: 0,
                paybackMonths: 0,
                confidence: 0,
                measures: [],
                executiveSummary: 'German summary',
                generatedAt: new Date().toISOString(),
            },
        });

        const profile = makeProfile({ runtimeHours: 25000 });
        const measure = makeMeasure({ typicalInvestment: 10000, typicalAnnualSavings: 20000 });
        const plan = await service.generatePlan(profile, [measure], 'user-1');

        expect(plan.totalInvestment).toBe(12500);
        expect(plan.totalAnnualSavings).toBe(25000);
    });
});
