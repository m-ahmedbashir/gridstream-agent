import { Injectable } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { deviceAssets, type DeviceAsset } from '@gridstream/shared';
import { DbService } from '../../common/db/db.service';

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
}
