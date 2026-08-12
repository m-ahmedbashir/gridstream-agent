import { z } from 'zod';
import { deviceAssetSelectSchema, faultDiagnosticSelectSchema } from '../db/schema';

/**
 * `GET /diagnostics` returns each FaultDiagnostic with its DeviceAsset
 * joined — not a 1:1 table row, so this is hand-written here rather than
 * derived via drizzle-zod, per AGENTS.md's rule for composite API shapes.
 */
export const faultDiagnosticWithDeviceSchema = faultDiagnosticSelectSchema.extend({
  device: deviceAssetSelectSchema,
});
export type FaultDiagnosticWithDevice = z.infer<typeof faultDiagnosticWithDeviceSchema>;

export const diagnosticsListResponseSchema = z.object({
  items: z.array(faultDiagnosticWithDeviceSchema),
  total: z.number(),
});
export type DiagnosticsListResponse = z.infer<typeof diagnosticsListResponseSchema>;
