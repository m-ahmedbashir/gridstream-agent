import { Module } from '@nestjs/common';
import { DbModule } from '../../common/db/db.module';
import { DiagnosticsService } from './diagnostics.service';

@Module({
  imports: [DbModule],
  providers: [DiagnosticsService],
  exports: [DiagnosticsService],
})
export class DiagnosticsModule {}
