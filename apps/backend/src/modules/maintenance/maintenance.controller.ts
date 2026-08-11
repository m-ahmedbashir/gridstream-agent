import {
    Controller,
    Post,
    Get,
    UploadedFile,
    UseInterceptors,
    Body,
    HttpCode,
    HttpStatus,
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator,
    Logger,
    Param,
    Query,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MaintenanceExtractionService, MaintenanceExtractionResult } from './maintenance-extraction.service';
import { MatchingService } from './matching.service';
import { PlanningService } from './planning.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MachineType, Criticality } from '@maintain/shared';
import { MODEL_REGISTRY } from '../extraction/model-registry';

class ExtractMaintenanceDto {
    text?: string;
    userId?: string;
    processingMode?: string;
    /** Per-upload override — falls back to the user's saved Settings model when omitted. */
    modelKey?: string;
}

class CreateMachineDto {
    machineId: string;
    machineType: string;
    criticality: string;
    location?: string;
    userId?: string;
}

class GeneratePlanDto {
    machineProfileId: string;
    measureIds: string[];
    userId?: string;
}

@Controller('maintenance')
export class MaintenanceController {
    private readonly logger = new Logger(MaintenanceController.name);

    constructor(
        private readonly maintenanceExtractionService: MaintenanceExtractionService,
        private readonly matchingService: MatchingService,
        private readonly planningService: PlanningService,
        private readonly usersService: UsersService,
        private readonly prisma: PrismaService,
    ) { }

    @Post('extract')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            limits: { fileSize: 10 * 1024 * 1024 },
        }),
    )
    async extractMaintenanceReport(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
                    new FileTypeValidator({
                        fileType: /^(text\/plain|text\/csv|application\/json|application\/pdf|image\/(png|jpeg|webp))$/,
                    }),
                ],
                fileIsRequired: false,
            }),
        )
        file: Express.Multer.File | undefined,
        @Body() dto: ExtractMaintenanceDto,
    ): Promise<MaintenanceExtractionResult> {
        this.logger.log(`Received maintenance report: file=${file?.originalname ?? 'none'}, text=${dto.text ? 'provided' : 'none'}`);

        if (dto.modelKey && !(dto.modelKey in MODEL_REGISTRY)) {
            throw new BadRequestException(
                `Unknown modelKey "${dto.modelKey}". Valid keys: ${Object.keys(MODEL_REGISTRY).join(', ')}`,
            );
        }

        const userId = dto.userId || 'default-user';
        const [settings, apiKeyOverride] = await Promise.all([
            this.usersService.getSettings(userId),
            this.usersService.getDecryptedApiKey(userId),
        ]);

        return this.maintenanceExtractionService.processFile(
            userId,
            file,
            dto.text,
            dto.modelKey || settings.modelKey,
            apiKeyOverride,
            dto.processingMode || settings.processingMode,
        );
    }

    /**
     * Seeded on a brand-new account's first visit to /machines, so Live
     * Monitoring never opens to an empty state — machineId is suffixed with
     * a per-user slice below to keep it unique across accounts.
     */
    private static readonly DEMO_MACHINES = [
        { machineType: 'CNC', manufacturer: 'DMG Mori', yearInstalled: 2020, runtimeHours: 15000, criticality: 'high', location: 'Halle 1 (Demo)' },
        { machineType: 'HVAC', manufacturer: 'Siemens', yearInstalled: 2019, runtimeHours: 22000, criticality: 'medium', location: 'Halle 2 (Demo)' },
        { machineType: 'Compressor', manufacturer: 'Atlas Copco', yearInstalled: 2021, runtimeHours: 9000, criticality: 'medium', location: 'Halle 3 (Demo)' },
    ] as const;

    @Get('machines')
    async listMachines(@Query('userId') rawUserId: string) {
        const userId = rawUserId || 'default-user';
        const user = await this.prisma.user.upsert({
            where: { clerkId: userId },
            create: { clerkId: userId },
            update: {},
        });

        let profiles = await this.prisma.machineProfile.findMany({
            where: { userId: user.id },
            orderBy: { extractedAt: 'desc' },
        });

        if (profiles.length === 0) {
            const suffix = user.id.slice(-6);
            await this.prisma.machineProfile.createMany({
                data: MaintenanceController.DEMO_MACHINES.map((m) => ({
                    userId: user.id,
                    machineId: `Demo-${m.machineType}-${suffix}`,
                    machineType: m.machineType,
                    manufacturer: m.manufacturer,
                    yearInstalled: m.yearInstalled,
                    runtimeHours: m.runtimeHours,
                    observedIssues: [],
                    criticality: m.criticality,
                    location: m.location,
                })),
                skipDuplicates: true,
            });
            profiles = await this.prisma.machineProfile.findMany({
                where: { userId: user.id },
                orderBy: { extractedAt: 'desc' },
            });
        }

        return {
            machines: profiles.map((p) => ({
                id: p.id,
                machineId: p.machineId,
                machineType: p.machineType,
                criticality: p.criticality,
                location: p.location,
                extractedAt: p.extractedAt.toISOString(),
                isDemo: p.machineId.startsWith('Demo-'),
            })),
        };
    }

    @Post('machines')
    async createMachine(@Body() dto: CreateMachineDto) {
        if (!dto.machineId?.trim()) {
            throw new BadRequestException('machineId is required');
        }
        if (!(MachineType.options as readonly string[]).includes(dto.machineType)) {
            throw new BadRequestException(`Invalid machineType. Valid values: ${MachineType.options.join(', ')}`);
        }
        if (!(Criticality.options as readonly string[]).includes(dto.criticality)) {
            throw new BadRequestException(`Invalid criticality. Valid values: ${Criticality.options.join(', ')}`);
        }

        const machineId = dto.machineId.trim();
        const existing = await this.prisma.machineProfile.findUnique({ where: { machineId } });
        if (existing) {
            throw new BadRequestException(`A machine with id "${machineId}" already exists.`);
        }

        const userId = dto.userId || 'default-user';
        const user = await this.prisma.user.upsert({
            where: { clerkId: userId },
            create: { clerkId: userId },
            update: {},
        });

        // Quick-add is deliberately minimal (name/type/criticality only) — everything
        // else defaults to a plausible placeholder, same as a low-confidence extraction.
        const profile = await this.prisma.machineProfile.create({
            data: {
                userId: user.id,
                machineId,
                machineType: dto.machineType,
                manufacturer: 'Unknown',
                yearInstalled: new Date().getFullYear(),
                runtimeHours: 0,
                observedIssues: [],
                criticality: dto.criticality,
                location: dto.location?.trim() || null,
            },
        });

        return { id: profile.id, machineId: profile.machineId };
    }

    @Get('measures')
    async getMeasures(@Query('machineProfileId') machineProfileId: string) {
        if (!machineProfileId) {
            throw new BadRequestException('machineProfileId query parameter is required');
        }
        const profile = await this.prisma.machineProfile.findUnique({ where: { id: machineProfileId } });
        if (!profile) {
            throw new NotFoundException(`MachineProfile ${machineProfileId} not found`);
        }
        const measures = await this.matchingService.findMeasures(profile as any);
        return { measures };
    }

    @Post('plan')
    async generatePlan(
        @Body() dto: GeneratePlanDto,
    ) {
        const profile = await this.prisma.machineProfile.findUnique({ where: { id: dto.machineProfileId } });
        if (!profile) {
            throw new NotFoundException(`MachineProfile ${dto.machineProfileId} not found`);
        }

        const measures = await this.prisma.measure.findMany({
            where: { id: { in: dto.measureIds } },
        });

        const plan = await this.planningService.generatePlan(
            profile as any,
            measures as any,
            dto.userId || 'default-user',
        );
        return plan;
    }

    @Get('plans/:id')
    async getPlan(@Param('id') id: string) {
        const plan = await this.prisma.plan.findUnique({
            where: { id },
            include: { machineProfile: { select: { machineId: true } } },
        });
        if (!plan) {
            throw new NotFoundException(`Plan ${id} not found`);
        }

        return {
            planId: plan.id,
            machineId: plan.machineProfile.machineId,
            status: plan.status,
            totalInvestment: plan.totalInvestment,
            totalAnnualSavings: plan.totalAnnualSavings,
            paybackMonths: plan.paybackMonths,
            totalDowntimeHours: plan.totalDowntimeHours,
            totalCo2ReductionKg: plan.totalCo2ReductionKg,
            confidence: plan.confidence,
            measures: plan.measures,
            executiveSummary: plan.executiveSummary,
            executiveSummaryEn: plan.executiveSummaryEn,
            generatedAt: plan.generatedAt.toISOString(),
        };
    }

    @Post('plans/:id/approve')
    async approvePlan(@Param('id') id: string, @Body() body: { userId?: string }) {
        const plan = await this.prisma.plan.update({
            where: { id },
            data: {
                status: 'approved',
                approvedAt: new Date(),
                approvedBy: body.userId || 'default-user',
            },
        });
        return plan;
    }

    @Post('plans/:id/reject')
    async rejectPlan(@Param('id') id: string, @Body() body: { userId?: string }) {
        const plan = await this.prisma.plan.update({
            where: { id },
            data: {
                status: 'rejected',
                approvedAt: new Date(),
                approvedBy: body.userId || 'default-user',
            },
        });
        return plan;
    }

    @Get('history')
    async getHistory(@Query('userId') userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { clerkId: userId || 'default-user' },
            include: {
                machineProfiles: {
                    include: {
                        plans: {
                            orderBy: { generatedAt: 'desc' },
                        },
                    },
                },
            },
        });

        if (!user) {
            return { plans: [] };
        }

        const plans = user.machineProfiles.flatMap((profile) =>
            profile.plans.map((plan) => ({
                id: plan.id,
                status: plan.status,
                totalInvestment: plan.totalInvestment,
                totalAnnualSavings: plan.totalAnnualSavings,
                paybackMonths: plan.paybackMonths,
                confidence: plan.confidence,
                executiveSummary: plan.executiveSummary,
                generatedAt: plan.generatedAt.toISOString(),
                approvedAt: plan.approvedAt?.toISOString(),
                machineProfile: {
                    machineId: profile.machineId,
                    machineType: profile.machineType,
                },
            })),
        );

        return { plans: plans.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)) };
    }

    @Get('stats')
    async getStats() {
        return this.maintenanceExtractionService.getStats();
    }
}
