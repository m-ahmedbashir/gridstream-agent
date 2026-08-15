import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, gte } from 'drizzle-orm';
import { deviceAssets, telemetryLogs, type DeviceAsset, type TelemetryLog } from '@gridstream/shared';
import { DbService } from '../../common/db/db.service';

const ONE_HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class DevicesService {
  constructor(private readonly dbService: DbService) {}

  async listDevices(params: {
    status?: DeviceAsset['status'];
    deviceType?: DeviceAsset['deviceType'];
    limit: number;
    offset: number;
  }): Promise<{ items: DeviceAsset[]; total: number }> {
    const { status, deviceType, limit, offset } = params;
    const conditions = [
      status ? eq(deviceAssets.status, status) : undefined,
      deviceType ? eq(deviceAssets.deviceType, deviceType) : undefined,
    ].filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, [totalRow]] = await Promise.all([
      this.dbService.db
        .select()
        .from(deviceAssets)
        .where(whereClause)
        .orderBy(desc(deviceAssets.createdAt))
        .limit(limit)
        .offset(offset),
      this.dbService.db.select({ total: count() }).from(deviceAssets).where(whereClause),
    ]);

    return { items, total: Number(totalRow?.total ?? 0) };
  }

  /**
   * Powers the alert-detail page's telemetry chart — this device's readings
   * over the last `hours`, oldest first (chart-friendly order). Confirms the
   * device exists first so a bad ID gets a clear 404 instead of an empty
   * chart that looks like "no data."
   */
  async getDeviceTelemetryHistory(deviceId: string, hours: number): Promise<{ items: TelemetryLog[] }> {
    const [device] = await this.dbService.db.select().from(deviceAssets).where(eq(deviceAssets.id, deviceId));
    if (!device) {
      throw new NotFoundException(`DeviceAsset ${deviceId} not found`);
    }

    const since = new Date(Date.now() - hours * ONE_HOUR_MS);
    const items = await this.dbService.db
      .select()
      .from(telemetryLogs)
      .where(and(eq(telemetryLogs.deviceId, deviceId), gte(telemetryLogs.timestamp, since)))
      .orderBy(asc(telemetryLogs.timestamp));

    return { items };
  }
}
