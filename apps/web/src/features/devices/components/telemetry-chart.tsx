'use client';

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { DeviceAsset } from '@gridstream/shared';
import { useDeviceTelemetryQuery } from '../hooks/use-devices';

// Same two thresholds isAnomalous() checks server-side
// (apps/api/src/modules/telemetry-ingestion/telemetry-thresholds.ts) —
// duplicated here only as display constants for the reference line, not
// re-implementing any anomaly logic.
const THERMAL_RUNAWAY_TEMP_C = 65;
const VOLTAGE_SAG_V = 200;

const chartConfig = {
  batteryTempCelsius: { label: 'Battery Temp (°C)', color: 'var(--destructive)' },
  gridVoltage: { label: 'Grid Voltage (V)', color: 'var(--primary)' },
} satisfies ChartConfig;

interface TelemetryChartProps {
  deviceId: string;
  deviceType: DeviceAsset['deviceType'];
}

/**
 * The device's telemetry over the last 24h, with the relevant safety
 * threshold drawn in — for BATTERY devices, battery temperature (thermal
 * runaway); for every other device type, grid voltage (sag). Answers "why
 * did this alert fire" visually, using the same 24h window
 * getHistoricalBaseline() reasons over.
 */
export function TelemetryChart({ deviceId, deviceType }: TelemetryChartProps) {
  const { data, isLoading, isError } = useDeviceTelemetryQuery(deviceId, 24);
  const isBattery = deviceType === 'BATTERY';

  const chartData = (data?.items ?? []).map((reading) => ({
    time: new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    batteryTempCelsius: reading.batteryTempCelsius,
    gridVoltage: reading.gridVoltage,
  }));
  const threshold = isBattery ? THERMAL_RUNAWAY_TEMP_C : VOLTAGE_SAG_V;
  const padding = isBattery ? 5 : 10;
  // Computed as a plain [min, max] tuple, not a Recharts domain-callback —
  // a function-based `domain` prop silently failed to expand past a
  // threshold±padding fallback range in practice (axis stuck at [60, 70]
  // while real readings spanned 21.6–82.4°C, clipping the entire series
  // off-screen). Always includes the threshold itself so the ReferenceLine
  // stays visible even if every reading in the window sits well clear of it.
  const values = chartData
    .map((d) => (isBattery ? d.batteryTempCelsius : d.gridVoltage))
    .filter((v): v is number => v != null)
    .concat(threshold);
  const domain: [number, number] = [Math.min(...values) - padding, Math.max(...values) + padding];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telemetry — last 24h</CardTitle>
        <CardDescription>
          {isBattery
            ? `Battery temperature (thermal-runaway threshold: ${THERMAL_RUNAWAY_TEMP_C}°C)`
            : `Grid voltage (sag threshold: ${VOLTAGE_SAG_V}V)`}
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        {isLoading ? (
          <Skeleton className='h-[250px] w-full' />
        ) : isError || !data ? (
          <div className='text-destructive flex h-[250px] items-center justify-center text-sm'>
            Failed to load telemetry history.
          </div>
        ) : chartData.length === 0 ? (
          <div className='text-muted-foreground flex h-[250px] items-center justify-center text-sm'>
            No telemetry history for this device yet.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className='aspect-auto h-[250px] w-full'>
            <AreaChart data={chartData} margin={{ left: 12, right: 12 }}>
              {/* `fill='var(--color-x)'` directly on <Area> rendered nothing in
                  practice — Recharts emits `fill`/`stroke` as raw SVG
                  presentation attributes, and `stroke='var(--color-x)'`
                  resolves fine there but `fill` did not. The one other chart
                  in this codebase (features/overview/area-graph.tsx) never
                  puts a CSS var directly in `fill` either — it always goes
                  through a <linearGradient>'s <stop stopColor>, which is
                  inside a real stylesheet-processed <defs> block. Matching
                  that exact, proven-working pattern here instead of guessing
                  at another `fill='var(...)'` variant. */}
              <defs>
                <linearGradient id='fillBatteryTemp' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='var(--color-batteryTempCelsius)' stopOpacity={0.4} />
                  <stop offset='95%' stopColor='var(--color-batteryTempCelsius)' stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id='fillGridVoltage' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='var(--color-gridVoltage)' stopOpacity={0.4} />
                  <stop offset='95%' stopColor='var(--color-gridVoltage)' stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey='time' tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
              <YAxis tickLine={false} axisLine={false} width={40} domain={domain} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator='dot' />} />
              {isBattery ? (
                <>
                  <ReferenceLine
                    y={THERMAL_RUNAWAY_TEMP_C}
                    stroke='var(--destructive)'
                    strokeDasharray='4 4'
                    label={{ value: `${THERMAL_RUNAWAY_TEMP_C}°C`, position: 'insideTopRight', fontSize: 11 }}
                  />
                  <Area
                    dataKey='batteryTempCelsius'
                    type='monotone'
                    fill='url(#fillBatteryTemp)'
                    stroke='var(--color-batteryTempCelsius)'
                    strokeWidth={2}
                  />
                </>
              ) : (
                <>
                  <ReferenceLine
                    y={VOLTAGE_SAG_V}
                    stroke='var(--destructive)'
                    strokeDasharray='4 4'
                    label={{ value: `${VOLTAGE_SAG_V}V`, position: 'insideTopRight', fontSize: 11 }}
                  />
                  <Area
                    dataKey='gridVoltage'
                    type='monotone'
                    fill='url(#fillGridVoltage)'
                    stroke='var(--color-gridVoltage)'
                    strokeWidth={2}
                  />
                </>
              )}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
