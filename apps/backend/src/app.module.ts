import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, ComplianceModule, UsersModule, MaintenanceModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
