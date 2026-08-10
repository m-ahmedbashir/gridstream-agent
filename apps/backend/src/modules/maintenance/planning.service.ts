import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
    ProjectPlanSchema,
    type MachineProfile,
    type Measure,
    type ProjectPlan,
    type MaintenanceTask,
} from '@maintain/shared';
import { resolveModel, type ModelKey } from '../extraction/model-registry';

/**
 * PlanningService
 *
 * Generates a concrete Industry 4.0 maintenance project plan from a machine
 * profile and a selected set of measures. Uses the AI SDK for executive-summary
 * generation and validates the full plan against ProjectPlanSchema.
 */
@Injectable()
export class PlanningService {
    private readonly logger = new Logger(PlanningService.name);

    constructor(private readonly prisma: PrismaService) { }

    async generatePlan(
        profile: MachineProfile,
        measures: Measure[],
        userId: string,
        modelKey: ModelKey = 'openrouter:nemotron-nano-12b-v2-vl-free',
        apiKeyOverride?: string,
    ): Promise<ProjectPlan> {
        const now = new Date().toISOString();

        // Base financials derived directly from the selected measures.
        const totalInvestment = measures.reduce((sum, m) => sum + m.typicalInvestment, 0);
        const totalAnnualSavings = measures.reduce((sum, m) => sum + m.typicalAnnualSavings, 0);
        const totalCo2ReductionKg = measures.reduce((sum, m) => sum + (m.co2ReductionKg ?? 0), 0);
        const totalDowntimeHours = measures.reduce(
            (sum, m) => sum + m.tasks.reduce((taskSum, t) => taskSum + t.durationDays, 0) * 24,
            0,
        );

        // Weighted payback: sum(investment * payback) / sum(investment).
        const weightedPayback = totalInvestment > 0
            ? measures.reduce((sum, m) => sum + m.typicalInvestment * m.paybackMonths, 0) / totalInvestment
            : 0;

        // Scale factor: larger facilities get proportionally higher numbers.
        // Use runtime hours as a rough proxy for facility utilisation/size.
        const scaleFactor = this.computeScaleFactor(profile, measures);
        const scaledInvestment = Math.round(totalInvestment * scaleFactor);
        const scaledAnnualSavings = Math.round(totalAnnualSavings * scaleFactor);

        // Confidence is anchored to the six-anchor system based on data completeness.
        const confidence = this.computeConfidence(profile, measures);

        const plannedMeasures = measures.map((m) => ({
            measureId: m.id,
            title: m.title,
            titleDe: m.titleDe,
            priority: this.inferPriority(m.category),
            investment: Math.round(m.typicalInvestment * scaleFactor),
            annualSavings: Math.round(m.typicalAnnualSavings * scaleFactor),
            paybackMonths: m.paybackMonths,
            tasks: m.tasks.map((t) => ({
                phase: t.phase,
                durationDays: t.durationDays,
                responsibleRole: t.responsibleRole,
                description: t.description,
            })),
        }));

        const planId = `plan-${profile.machineId}-${Date.now()}`;

        // Use the model only for the executive summaries; all financials are computed here.
        const { object } = await generateObject({
            model: resolveModel(modelKey, apiKeyOverride),
            schema: ProjectPlanSchema,
            messages: [
                {
                    role: 'user',
                    content: `You are a German Industry 4.0 maintenance planner (Instandhaltungsplaner).

Create a concrete project plan for the following machine. The financial totals, selected measures, and task lists below are already fixed — do not change them. Your job is to write the executiveSummary in German for a plant manager (Geschäftsführer) and the optional executiveSummaryEn in English as a backup.

Machine Profile:
- Machine ID: ${profile.machineId}
- Machine Type: ${profile.machineType}
- Manufacturer: ${profile.manufacturer}
- Year Installed: ${profile.yearInstalled}
- Runtime Hours: ${profile.runtimeHours}
- Criticality: ${profile.criticality}
- Observed Issues: ${profile.observedIssues.join(', ')}
- Energy Consumption: ${profile.energyConsumptionKwh ?? 'unknown'} kWh/h
- Location: ${profile.location ?? 'unknown'}

Selected Measures:
${measures.map((m) => `- ${m.titleDe} (${m.category}): Investment €${Math.round(m.typicalInvestment * scaleFactor).toLocaleString('de-DE')}, Savings €${Math.round(m.typicalAnnualSavings * scaleFactor).toLocaleString('de-DE')}/year, Payback ${m.paybackMonths} months`).join('\n')}

Computed Totals (MUST match):
- totalInvestment: ${scaledInvestment}
- totalAnnualSavings: ${scaledAnnualSavings}
- paybackMonths: ${Math.round(weightedPayback)}
- totalDowntimeHours: ${totalDowntimeHours}
- totalCo2ReductionKg: ${totalCo2ReductionKg}
- confidence: ${confidence}

Return a JSON object matching the ProjectPlanSchema exactly.`,
                },
            ],
        });

        const generated = object as ProjectPlan;

        // Override model-generated computed fields with our own deterministic values.
        const plan: ProjectPlan = {
            ...generated,
            planId,
            machineId: profile.machineId,
            status: 'draft',
            totalInvestment: scaledInvestment,
            totalAnnualSavings: scaledAnnualSavings,
            paybackMonths: Math.round(weightedPayback),
            totalDowntimeHours: totalDowntimeHours || null,
            totalCo2ReductionKg: totalCo2ReductionKg || null,
            confidence,
            measures: plannedMeasures,
            generatedAt: now,
        };

        const user = await this.prisma.user.findUnique({ where: { clerkId: userId }, select: { planApprovalMode: true } });
        const planApprovalMode = user?.planApprovalMode ?? 'MANUAL_REVIEW';

        if (plan.totalInvestment < 50000 && plan.confidence >= 0.8 && planApprovalMode === 'AUTO_APPROVE') {
            plan.status = 'approved';
        }

        await this.persistPlan(profile, plan, userId);

        this.logger.log(`Generated plan ${planId} for machine ${profile.machineId} with status ${plan.status}.`);
        return plan;
    }

    private computeScaleFactor(profile: MachineProfile, measures: Measure[]): number {
        if (measures.length === 0) {
            return 1;
        }
        // Mild scaling: high runtime suggests a larger/more heavily used installation.
        if (profile.runtimeHours > 20000) return 1.25;
        if (profile.runtimeHours > 10000) return 1.1;
        return 1;
    }

    private computeConfidence(profile: MachineProfile, measures: Measure[]): number {
        const requiredFields: (keyof MachineProfile)[] = [
            'machineId',
            'machineType',
            'manufacturer',
            'yearInstalled',
            'runtimeHours',
            'criticality',
        ];
        const filledRequired = requiredFields.filter((f) => {
            const value = profile[f];
            return value !== null && value !== undefined && (Array.isArray(value) ? value.length > 0 : true);
        }).length;

        const hasMeasures = measures.length > 0;
        const hasIssues = profile.observedIssues.length > 0;

        if (filledRequired === requiredFields.length && hasMeasures && hasIssues) return 0.8;
        if (filledRequired >= requiredFields.length - 1 && hasMeasures) return 0.6;
        if (filledRequired >= requiredFields.length - 2 && hasMeasures) return 0.4;
        if (filledRequired >= 3) return 0.2;
        return 0.0;
    }

    private inferPriority(category: string): 'immediate' | 'scheduled' | 'planned' {
        switch (category) {
            case 'safety':
            case 'critical':
                return 'immediate';
            case 'predictive':
            case 'efficiency':
                return 'scheduled';
            default:
                return 'planned';
        }
    }

    private async persistPlan(profile: MachineProfile, plan: ProjectPlan, userId: string) {
        const dbProfile = await this.prisma.machineProfile.findUnique({
            where: { machineId: profile.machineId },
            select: { id: true },
        });

        if (!dbProfile) {
            throw new Error(`MachineProfile ${profile.machineId} not found when persisting plan`);
        }

        await this.prisma.plan.create({
            data: {
                machineProfileId: dbProfile.id,
                status: plan.status,
                confidence: plan.confidence,
                totalInvestment: plan.totalInvestment,
                totalAnnualSavings: plan.totalAnnualSavings,
                paybackMonths: plan.paybackMonths,
                totalDowntimeHours: plan.totalDowntimeHours ?? null,
                totalCo2ReductionKg: plan.totalCo2ReductionKg ?? null,
                measures: plan.measures as any,
                executiveSummary: plan.executiveSummary,
                executiveSummaryEn: plan.executiveSummaryEn ?? null,
                approvedAt: plan.status === 'approved' ? new Date() : null,
                approvedBy: plan.status === 'approved' ? userId : null,
            },
        });
    }
}
