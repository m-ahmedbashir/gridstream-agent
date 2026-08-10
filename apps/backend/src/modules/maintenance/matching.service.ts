import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { MachineProfile, Measure } from '@maintain/shared';

/**
 * MatchingService
 *
 * Finds the most relevant maintenance measures for a given machine profile.
 */
@Injectable()
export class MatchingService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Returns up to 5 measures that match the machine type and minimum runtime.
     * Sorted by paybackMonths ascending (fastest ROI first).
     */
    async findMeasures(profile: MachineProfile): Promise<Measure[]> {
        const measures = await this.prisma.measure.findMany();

        return measures
            .map((m) => m as unknown as Measure)
            .filter((measure) => measure.applicableMachineTypes.includes(profile.machineType))
            .filter((measure) => {
                if (measure.minRuntimeHours === undefined || measure.minRuntimeHours === null) {
                    return true;
                }
                return profile.runtimeHours >= measure.minRuntimeHours;
            })
            .sort((a, b) => a.paybackMonths - b.paybackMonths)
            .slice(0, 5);
    }
}
