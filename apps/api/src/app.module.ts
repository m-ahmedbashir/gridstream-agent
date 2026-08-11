import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './common/db/db.module';
import { UsersModule } from './modules/users/users.module';
import { ExtractionModule } from './modules/extraction/extraction.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DbModule, UsersModule, ExtractionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
