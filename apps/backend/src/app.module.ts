import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ExtractionModule } from './modules/extraction/extraction.module';
import { PrismaModule } from './common/prisma/prisma.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, ComplianceModule, ExtractionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
