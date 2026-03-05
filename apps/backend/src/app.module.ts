import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ExtractionModule } from './modules/extraction/extraction.module';

@Module({
  imports: [ComplianceModule, ExtractionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
