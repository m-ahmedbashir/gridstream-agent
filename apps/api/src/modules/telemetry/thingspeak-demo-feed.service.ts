import { Injectable, Logger } from '@nestjs/common';

export interface RawFeedMessage {
    /** Dedup key from the source feed (ThingSpeak's entry_id). */
    externalId: string;
    /** Unix ms timestamp the reading was recorded. */
    timestamp: number;
    /** The field value read off the channel — see FIELD_KEY. */
    rawValue: number;
}

/**
 * ThingSpeakDemoFeedService
 *
 * Reads a real, free, public ThingSpeak channel (MathWorks' own long-running
 * weather-station demo, channel 12397) via its plain REST API — no key, no
 * signup. This is real live data updating minute-to-minute, but it's a
 * weather station, not industrial machine telemetry, so TelemetryService
 * treats it purely as a live entropy source and re-baselines every value
 * around each machine's own profile rather than displaying it as-is. See
 * FEATURE_PLAN.md ("Phase 2") for the full reasoning.
 *
 * field2 (wind speed, mph) is used because it's the one field on this
 * channel that's still actually live — several of the channel's other
 * fields (temperature, humidity) have been stuck at flat values for a long
 * time, which was confirmed by hand before wiring this up.
 *
 * Never throws: any failure (network, unexpected shape, empty channel)
 * yields an empty array, matching the graceful-degradation pattern used by
 * CarbonIntensityService elsewhere in this app.
 */
@Injectable()
export class ThingSpeakDemoFeedService {
    private readonly logger = new Logger(ThingSpeakDemoFeedService.name);

    private static readonly CHANNEL_ID = 12397;
    private static readonly FEEDS_URL = `https://api.thingspeak.com/channels/${ThingSpeakDemoFeedService.CHANNEL_ID}/feeds.json`;
    private static readonly FIELD_KEY = 'field2';

    async fetchRecent(count = 20): Promise<RawFeedMessage[]> {
        try {
            const response = await fetch(`${ThingSpeakDemoFeedService.FEEDS_URL}?results=${count}`);

            if (!response.ok) {
                this.logger.warn(`ThingSpeak request failed: ${response.status} ${response.statusText}`);
                return [];
            }

            const body = await response.json();
            const feeds = Array.isArray(body?.feeds) ? body.feeds : [];

            const messages: RawFeedMessage[] = [];
            for (const feed of feeds) {
                const rawValue = Number(feed?.[ThingSpeakDemoFeedService.FIELD_KEY]);
                if (!Number.isFinite(rawValue)) continue;

                const timestamp = feed?.created_at ? Date.parse(feed.created_at) : NaN;

                messages.push({
                    externalId: feed?.entry_id !== undefined ? String(feed.entry_id) : `${rawValue}-${messages.length}`,
                    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
                    rawValue,
                });
            }

            return messages;
        } catch (error) {
            this.logger.warn(`ThingSpeak request threw: ${error instanceof Error ? error.message : 'unknown error'}`);
            return [];
        }
    }
}
