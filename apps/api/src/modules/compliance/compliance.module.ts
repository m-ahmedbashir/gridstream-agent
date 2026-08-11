import { Module } from '@nestjs/common';
import { ComplianceService } from './compliance.service';

/**
 * ComplianceModule
 *
 * Provides PII-masking capabilities to any module that imports it.
 * Export ComplianceService so it can be injected by the ExtractionModule
 * (and any future modules) without re-declaring it.
 */
@Module({
    providers: [ComplianceService],
    exports: [ComplianceService],
})
export class ComplianceModule { }
