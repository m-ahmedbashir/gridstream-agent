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
        ) : data.items.length === 0 ? (
          <div className='text-muted-foreground flex h-[250px] items-center justify-center text-sm'>
            No telemetry history for this device yet.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className='aspect-auto h-[250px] w-full'>
            <AreaChart
              data={data.items.map((reading) => ({
                time: new Date(reading.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                batteryTempCelsius: reading.batteryTempCelsius,
                gridVoltage: reading.gridVoltage,
              }))}
              margin={{ left: 12, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey='time' tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
              <YAxis tickLine={false} axisLine={false} width={40} domain={isBattery ? undefined : [180, 250]} />
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
                    fill='var(--color-batteryTempCelsius)'
                    fillOpacity={0.2}
                    stroke='var(--color-batteryTempCelsius)'
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
                    fill='var(--color-gridVoltage)'
                    fillOpacity={0.2}
                    stroke='var(--color-gridVoltage)'
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
