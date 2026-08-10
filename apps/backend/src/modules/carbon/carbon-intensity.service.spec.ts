import { CarbonIntensityService } from './carbon-intensity.service';

describe('CarbonIntensityService', () => {
    const originalToken = process.env.ELECTRICITY_MAPS_TOKEN;
    let service: CarbonIntensityService;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        service = new CarbonIntensityService();
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        process.env.ELECTRICITY_MAPS_TOKEN = originalToken;
        jest.clearAllMocks();
    });

    it('returns null without throwing when no token is configured', async () => {
        delete process.env.ELECTRICITY_MAPS_TOKEN;

        const result = await service.getLatest('DE');

        expect(result).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns the parsed carbon intensity on a successful response', async () => {
        process.env.ELECTRICITY_MAPS_TOKEN = 'test-token';
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ zone: 'DE', carbonIntensity: 285, datetime: '2026-08-10T12:00:00Z' }),
        });

        const result = await service.getLatest('DE');

        expect(result).toEqual({ zone: 'DE', carbonIntensity: 285, unit: 'gCO2eq/kWh', datetime: '2026-08-10T12:00:00Z' });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('zone=DE'),
            expect.objectContaining({ headers: { 'auth-token': 'test-token' } }),
        );
    });

    it('caches a successful response for subsequent calls within the TTL', async () => {
        process.env.ELECTRICITY_MAPS_TOKEN = 'test-token';
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({ zone: 'DE', carbonIntensity: 300, datetime: '2026-08-10T12:00:00Z' }),
        });

        await service.getLatest('DE');
        await service.getLatest('DE');

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns null without throwing when the request fails', async () => {
        process.env.ELECTRICITY_MAPS_TOKEN = 'test-token';
        fetchMock.mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' });

        const result = await service.getLatest('DE');

        expect(result).toBeNull();
    });

    it('returns null without throwing when fetch itself rejects', async () => {
        process.env.ELECTRICITY_MAPS_TOKEN = 'test-token';
        fetchMock.mockRejectedValue(new Error('network down'));

        const result = await service.getLatest('DE');

        expect(result).toBeNull();
    });
});
