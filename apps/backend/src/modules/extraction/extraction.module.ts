import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ExtractionController } from './extraction.controller';
import { ExtractionService } from './extraction.service';

@Module({
    imports: [ComplianceModule, PrismaModule],
    controllers: [ExtractionController],
    providers: [ExtractionService],
})
export class ExtractionModule { }
