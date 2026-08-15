import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ClerkAuthGuard } from '../../common/auth/clerk-auth.guard';
import { DevicesService } from './devices.service';

const listQuerySchema = z.object({
  status: z.enum(['ONLINE', 'OFFLINE', 'MAINTENANCE']).optional(),
  deviceType: z.enum(['SOLAR', 'BATTERY', 'HEAT_PUMP', 'WALLBOX']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const telemetryHistoryQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(168).default(24),
});

@Controller('devices')
@UseGuards(ClerkAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  async list(@Query() query: unknown) {
    const parsed = listQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.devicesService.listDevices(parsed.data);
  }

  @Get(':id/telemetry')
  async getTelemetryHistory(@Param('id') id: string, @Query() query: unknown) {
    const parsed = telemetryHistoryQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.devicesService.getDeviceTelemetryHistory(id, parsed.data.hours);
  }
}
