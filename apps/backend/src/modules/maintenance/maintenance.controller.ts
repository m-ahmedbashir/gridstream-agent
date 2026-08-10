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

class ExtractMaintenanceDto {
    text?: string;
    userId?: string;
    processingMode?: string;
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

        const userId = dto.userId || 'default-user';
        const [settings, apiKeyOverride] = await Promise.all([
            this.usersService.getSettings(userId),
            this.usersService.getDecryptedApiKey(userId),
        ]);

        return this.maintenanceExtractionService.processFile(
            userId,
            file,
            dto.text,
            settings.modelKey,
            apiKeyOverride,
            dto.processingMode || settings.processingMode,
        );
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
