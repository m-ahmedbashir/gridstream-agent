import { Module } from '@nestjs/common';
import { DbModule } from '../../common/db/db.module';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [DbModule],
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}
