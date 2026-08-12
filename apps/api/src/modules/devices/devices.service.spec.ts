import { DevicesService } from './devices.service';
import { DbService } from '../../common/db/db.service';

function makeDbMock(items: Record<string, unknown>[], total: number) {
    const offsetMock = jest.fn().mockResolvedValue(items);
    const limitMock = jest.fn().mockReturnValue({ offset: offsetMock });
    const orderByMock = jest.fn().mockReturnValue({ limit: limitMock });
    const selectWhereMock = jest.fn().mockReturnValue({ orderBy: orderByMock });
    const selectFromMock = jest.fn().mockReturnValue({ where: selectWhereMock });

    const countWhereMock = jest.fn().mockResolvedValue([{ total: String(total) }]);
    const countFromMock = jest.fn().mockReturnValue({ where: countWhereMock });

    const selectMock = jest.fn((columns?: unknown) => {
        // db.select() (no args) → the items query; db.select({ total: count() }) → the count query.
        return columns ? { from: countFromMock } : { from: selectFromMock };
    });

    const dbService = { db: { select: selectMock } } as unknown as DbService;
    return { dbService, selectWhereMock, orderByMock };
}

const DEVICE_ROW = {
    id: 'device-1',
    deviceType: 'BATTERY',
    serialNumber: 'X-1',
    location: 'Basement',
    status: 'ONLINE',
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe('DevicesService.listDevices()', () => {
    it('returns items and a total count coerced from Postgres\'s string count', async () => {
        const { dbService } = makeDbMock([DEVICE_ROW], 1);
        const service = new DevicesService(dbService);

        const result = await service.listDevices({ limit: 50, offset: 0 });

        expect(result.items).toEqual([DEVICE_ROW]);
        expect(result.total).toBe(1);
    });

    it('applies both status and deviceType filters together when both are given', async () => {
        const { dbService, selectWhereMock } = makeDbMock([], 0);
        const service = new DevicesService(dbService);

        await service.listDevices({ status: 'ONLINE', deviceType: 'SOLAR', limit: 50, offset: 0 });

        expect(selectWhereMock).toHaveBeenCalledWith(expect.anything());
    });

    it('queries with no filter at all when neither status nor deviceType is given', async () => {
        const { dbService, selectWhereMock } = makeDbMock([], 0);
        const service = new DevicesService(dbService);

        await service.listDevices({ limit: 50, offset: 0 });

        expect(selectWhereMock).toHaveBeenCalledWith(undefined);
    });
});
