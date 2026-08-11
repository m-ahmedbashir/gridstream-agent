import { Injectable, Logger } from '@nestjs/common';

export interface CarbonIntensity {
    zone: string;
    carbonIntensity: number;
    unit: 'gCO2eq/kWh';
    datetime: string;
}

interface CacheEntry {
    value: CarbonIntensity;
    expiresAt: number;
}

/**
 * CarbonIntensityService
 *
 * Reads live grid carbon intensity from Electricity Maps so the planning
 * prompt can recommend scheduling energy-intensive work during low-carbon
 * hours. This is a decorative signal for the model's prose only — it never
 * touches any computed financial (see PlanningService) — so a failure here
 * must never be allowed to break plan generation.
 */
@Injectable()
export class CarbonIntensityService {
    private readonly logger = new Logger(CarbonIntensityService.name);
    private static readonly API_URL = 'https://api.electricitymaps.com/v3/carbon-intensity/latest';
    private static readonly CACHE_TTL_MS = 5 * 60 * 1000;

    private readonly cache = new Map<string, CacheEntry>();

    /**
     * Returns the latest carbon intensity for the given zone, or null if the
     * token isn't configured, the request fails, or the response is
     * unusable. Never throws.
     */
    async getLatest(zone = 'DE'): Promise<CarbonIntensity | null> {
        const token = process.env.ELECTRICITY_MAPS_TOKEN;
        if (!token) {
            return null;
        }

        const cached = this.cache.get(zone);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }

        try {
            const response = await fetch(`${CarbonIntensityService.API_URL}?zone=${encodeURIComponent(zone)}`, {
                headers: { 'auth-token': token },
            });

            if (!response.ok) {
                this.logger.warn(`Electricity Maps request failed: ${response.status} ${response.statusText}`);
                return null;
            }

            const body = await response.json();
            if (typeof body?.carbonIntensity !== 'number') {
                this.logger.warn('Electricity Maps response missing carbonIntensity field');
                return null;
            }

            const value: CarbonIntensity = {
                zone: body.zone ?? zone,
                carbonIntensity: body.carbonIntensity,
                unit: 'gCO2eq/kWh',
                datetime: body.datetime ?? new Date().toISOString(),
            };

            this.cache.set(zone, { value, expiresAt: Date.now() + CarbonIntensityService.CACHE_TTL_MS });
            return value;
        } catch (error) {
            this.logger.warn(`Electricity Maps request threw: ${error instanceof Error ? error.message : 'unknown error'}`);
            return null;
        }
    }
}
