import { z } from 'zod';
import { deviceAssetSelectSchema } from '../db/schema';

export const devicesListResponseSchema = z.object({
  items: z.array(deviceAssetSelectSchema),
  total: z.number(),
});
export type DevicesListResponse = z.infer<typeof devicesListResponseSchema>;
