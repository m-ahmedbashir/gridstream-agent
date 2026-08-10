import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceExtractionService } from './maintenance-extraction.service';
import { MatchingService } from './matching.service';
import { PlanningService } from './planning.service';
import { OcrService } from '../extraction/ocr.service';

@Module({
    imports: [ComplianceModule, PrismaModule, UsersModule],
    controllers: [MaintenanceController],
    providers: [MaintenanceExtractionService, MatchingService, PlanningService, OcrService],
})
export class MaintenanceModule { }
