import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ThingSpeakDemoFeedService } from './thingspeak-demo-feed.service';

export type ReadingStatus = 'normal' | 'warning' | 'critical';

export interface TelemetryReading {
    id: string;
    metric: string;
    value: number;
    unit: string;
    recordedAt: string;
}

export interface TelemetrySnapshot {
    machineProfileId: string;
    machineId: string;
    /** The machine's static business-importance rating — unrelated to `status` below. */
    criticality: string;
    baseline: number;
    unit: string;
    /** Live sensor health, derived from the latest reading vs. baseline — unrelated to `criticality` above. */
    status: ReadingStatus;
    suggestedIssues: string[];
    readings: TelemetryReading[];
    isSimulated: true;
}

/**
 * TelemetryService
 *
 * Turns the raw external demo feed (ThingSpeakDemoFeedService) into per-machine
 * "operating temperature" readings, persists them, and derives a simple
 * threshold-based health status. This is explicitly simulated data re-baselined
 * around each machine's profile — never presented as real sensor telemetry.
 * See FEATURE_PLAN.md ("Phase 2") for why there's no real industrial feed to
 * point at instead.
 *
 * A warning/critical status also gets appended to the machine's own
 * MachineProfile.observedIssues (deduped, stable wording) — this is the whole
 * point of the feature: a live anomaly should flow into the *same* profile
 * the existing matching/planning pipeline already reads, not live in a
 * parallel system nobody else sees.
 */
@Injectable()
export class TelemetryService {
    private readonly logger = new Logger(TelemetryService.name);

    private static readonly UNIT = '°C';

    /** Plausible resting operating temperature by machine type, in °C. */
    private static readonly BASELINE_BY_TYPE: Record<string, number> = {
        CNC: 55,
        HVAC: 24,
        Compressor: 65,
        Pump: 40,
        Conveyor: 35,
        Other: 45,
    };

    private static readonly WARNING_RATIO = 1.15;
    private static readonly CRITICAL_RATIO = 1.3;

    constructor(
        private readonly prisma: PrismaService,
        private readonly feedService: ThingSpeakDemoFeedService,
    ) { }

    async getSnapshot(machineProfileId: string): Promise<TelemetrySnapshot> {
        const profile = await this.prisma.machineProfile.findUnique({ where: { id: machineProfileId } });
        if (!profile) {
            throw new NotFoundException(`MachineProfile ${machineProfileId} not found`);
        }

        const baseline = TelemetryService.BASELINE_BY_TYPE[profile.machineType] ?? TelemetryService.BASELINE_BY_TYPE.Other;

        const raw = await this.feedService.fetchRecent(20);
        if (raw.length > 0) {
            const rows = raw.map((m) => ({
                machineProfileId,
                externalId: m.externalId,
                metric: 'temperature',
                value: this.normalize(m.rawValue, baseline),
                unit: TelemetryService.UNIT,
                recordedAt: new Date(m.timestamp),
            }));

            try {
                await this.prisma.machineReading.createMany({ data: rows, skipDuplicates: true });
            } catch (error) {
                // Persistence is best-effort — the snapshot below still returns fresh
                // data even if a write races with another request's dedup check.
                this.logger.warn(`Failed to persist telemetry readings: ${error instanceof Error ? error.message : 'unknown error'}`);
            }
        }

        const stored = await this.prisma.machineReading.findMany({
            where: { machineProfileId },
            orderBy: { recordedAt: 'desc' },
            take: 20,
        });

        const readings: TelemetryReading[] = stored
            .map((r) => ({ id: r.id, metric: r.metric, value: r.value, unit: r.unit, recordedAt: r.recordedAt.toISOString() }))
            .reverse();

        const latestValue = readings.at(-1)?.value ?? baseline;
        const status = this.computeStatus(latestValue, baseline);
        const suggestedIssues = this.buildSuggestedIssues(status);

        if (suggestedIssues.length > 0) {
            await this.appendToObservedIssues(machineProfileId, profile.observedIssues, suggestedIssues);
        }

        return {
            machineProfileId,
            machineId: profile.machineId,
            criticality: profile.criticality,
            baseline,
            unit: TelemetryService.UNIT,
            status,
            suggestedIssues,
            readings,
            isSimulated: true,
        };
    }

    /**
     * Maps a raw external reading (live wind speed in mph, typically ~2-8)
     * onto a plausible band around this machine's own baseline temperature,
     * so the number reads as "this machine" rather than raw weather data.
     * The source value only supplies live variation — its real-world units
     * are irrelevant once re-baselined.
     */
    private normalize(rawValue: number, baseline: number): number {
        const delta = (rawValue - 5) * 3;
        const clamped = Math.max(-baseline * 0.4, Math.min(baseline * 0.4, delta));
        return Math.round((baseline + clamped) * 10) / 10;
    }

    private computeStatus(value: number, baseline: number): ReadingStatus {
        if (value >= baseline * TelemetryService.CRITICAL_RATIO) return 'critical';
        if (value >= baseline * TelemetryService.WARNING_RATIO) return 'warning';
        return 'normal';
    }

    /**
     * Deliberately stable (no embedded reading) so repeated warnings dedupe
     * cleanly against MachineProfile.observedIssues instead of appending a
     * near-duplicate every time the live value ticks by 0.1.
     */
    private buildSuggestedIssues(status: ReadingStatus): string[] {
        if (status === 'normal') return [];
        const severity = status === 'critical' ? 'Critically elevated' : 'Elevated';
        return [`${severity} operating temperature detected via live monitoring — inspect cooling/lubrication.`];
    }

    private async appendToObservedIssues(machineProfileId: string, existing: string[], newIssues: string[]): Promise<void> {
        const additions = newIssues.filter((issue) => !existing.includes(issue));
        if (additions.length === 0) return;

        try {
            await this.prisma.machineProfile.update({
                where: { id: machineProfileId },
                data: { observedIssues: [...existing, ...additions] },
            });
        } catch (error) {
            this.logger.warn(`Failed to append live-detected issues to machine profile: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }
}
