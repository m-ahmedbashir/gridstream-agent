'use client';

import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { FaultDiagnosticWithDevice } from '@gridstream/shared';
import { TelemetryChart } from '@/features/devices/components/telemetry-chart';
import { useDiagnosticQuery } from '../hooks/use-diagnostics';
import { DiagnosticActions } from './diagnostic-actions';

const SEVERITY_VARIANT: Record<FaultDiagnosticWithDevice['severity'], 'outline' | 'secondary' | 'destructive'> = {
  LOW: 'outline',
  MEDIUM: 'secondary',
  HIGH: 'destructive',
  CRITICAL: 'destructive',
};

export function DiagnosticDetail({ id }: { id: string }) {
  const { data, isLoading, isError, error } = useDiagnosticQuery(id);

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <Link href='/dashboard/alerts' className='text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm'>
        <IconArrowLeft className='h-4 w-4' /> Back to Active Alerts
      </Link>

      {isLoading ? (
        <div className='space-y-4'>
          <Skeleton className='h-40 w-full' />
          <Skeleton className='h-[250px] w-full' />
        </div>
      ) : isError || !data ? (
        <div className='text-destructive rounded-md border p-4 text-sm'>
          Failed to load this alert: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className='flex flex-row items-start justify-between'>
              <div className='space-y-2'>
                <div className='flex items-center gap-2'>
                  <Badge variant={SEVERITY_VARIANT[data.severity]}>{data.severity}</Badge>
                  {data.requiresImmediateDispatch && <Badge variant='destructive'>Immediate dispatch</Badge>}
                </div>
                <CardTitle className='text-xl'>{data.faultType}</CardTitle>
              </div>
              <DiagnosticActions diagnostic={data} />
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <div className='text-muted-foreground text-xs font-medium uppercase'>Summary</div>
                <p className='text-sm'>{data.summary}</p>
              </div>
              <div>
                <div className='text-muted-foreground text-xs font-medium uppercase'>Recommended Action</div>
                <p className='text-sm'>{data.recommendedAction}</p>
              </div>
              <div className='grid grid-cols-2 gap-4 border-t pt-4 text-sm sm:grid-cols-4'>
                <div>
                  <div className='text-muted-foreground text-xs'>Device</div>
                  <div>{data.device.serialNumber}</div>
                </div>
                <div>
                  <div className='text-muted-foreground text-xs'>Location</div>
                  <div>{data.device.location ?? 'Unknown'}</div>
                </div>
                <div>
                  <div className='text-muted-foreground text-xs'>Detected</div>
                  <div>{new Date(data.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className='text-muted-foreground text-xs'>Decided</div>
                  <div>{data.approvedAt ? new Date(data.approvedAt).toLocaleString() : '—'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <TelemetryChart deviceId={data.device.id} deviceType={data.device.deviceType} />
        </>
      )}
    </div>
  );
}
