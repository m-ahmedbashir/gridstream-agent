import { z } from 'zod';
import { deviceAssetSelectSchema, telemetryLogSelectSchema } from '../db/schema';

export const devicesListResponseSchema = z.object({
  items: z.array(deviceAssetSelectSchema),
  total: z.number(),
});
export type DevicesListResponse = z.infer<typeof devicesListResponseSchema>;

export const deviceTelemetryHistoryResponseSchema = z.object({
  items: z.array(telemetryLogSelectSchema),
});
export type DeviceTelemetryHistoryResponse = z.infer<typeof deviceTelemetryHistoryResponseSchema>;
