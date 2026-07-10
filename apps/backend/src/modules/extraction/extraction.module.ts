import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { ExtractionController } from './extraction.controller';
import { ExtractionService } from './extraction.service';
import { OcrService } from './ocr.service';

@Module({
    imports: [ComplianceModule, PrismaModule, UsersModule],
    controllers: [ExtractionController],
    providers: [ExtractionService, OcrService],
})
export class ExtractionModule { }
