import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module';
import { ExtractionController } from './extraction.controller';
import { ExtractionService } from './extraction.service';

/**
 * ExtractionModule
 *
 * Imports ComplianceModule so that ComplianceService is available
 * for injection into ExtractionService via NestJS's DI container.
 */
@Module({
    imports: [ComplianceModule],
    controllers: [ExtractionController],
    providers: [ExtractionService],
})
export class ExtractionModule { }
