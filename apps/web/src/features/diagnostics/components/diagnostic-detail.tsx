'use client';

import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConfidenceFactorBreakdown } from '@gridstream/shared';
import { TelemetryChart } from '@/features/devices/components/telemetry-chart';
import { useDiagnosticQuery } from '../hooks/use-diagnostics';
import { ANOMALY_KIND_LABEL, CONFIDENCE_COLOR, SEVERITY_COLOR, STATUS_COLOR } from './columns';
import { DiagnosticActions } from './diagnostic-actions';

const CONFIDENCE_FACTOR_LABEL: Record<keyof ConfidenceFactorBreakdown, string> = {
  deviationStrength: 'Deviation strength',
  baselineCorroboration: 'Baseline corroboration',
  manualCorroboration: 'Manufacturer guidance',
  investigationCompleteness: 'Investigation completeness',
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
                  <Badge variant='outline' className={SEVERITY_COLOR[data.severity]}>
                    {data.severity}
                  </Badge>
                  {data.requiresImmediateDispatch && (
                    <Badge variant='outline' className={STATUS_COLOR.danger}>
                      Immediate dispatch
                    </Badge>
                  )}
                  {data.confidenceLabel != null && (
                    <Badge variant='outline' className={CONFIDENCE_COLOR[data.confidenceLabel]}>
                      {data.confidenceLabel} confidence ({data.confidenceScore}/100)
                    </Badge>
                  )}
                </div>
                <CardTitle className='text-xl'>{ANOMALY_KIND_LABEL[data.faultType]}</CardTitle>
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

              {data.confidenceFactors && (
                <div className='border-t pt-4'>
                  <div className='text-muted-foreground mb-2 text-xs font-medium uppercase'>Why this confidence score</div>
                  <ul className='space-y-1 text-sm'>
                    {(Object.keys(data.confidenceFactors) as (keyof ConfidenceFactorBreakdown)[]).map((key) => {
                      const factor = data.confidenceFactors![key];
                      return (
                        <li key={key} className='flex justify-between gap-4'>
                          <span>
                            {CONFIDENCE_FACTOR_LABEL[key]} — <span className='text-muted-foreground'>{factor.detail}</span>
                          </span>
                          <span className='text-muted-foreground shrink-0 tabular-nums'>
                            {factor.points}/{factor.max}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {data.executionTrace && data.executionTrace.length > 0 && (
                <div className='border-t pt-2'>
                  <Accordion type='single' collapsible>
                    <AccordionItem value='execution-trace'>
                      <AccordionTrigger className='text-muted-foreground text-xs font-medium uppercase'>
                        Raw execution trace ({data.executionTrace.length} tool call{data.executionTrace.length === 1 ? '' : 's'})
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className='space-y-3'>
                          {data.executionTrace.map((step, i) => (
                            <div key={i} className='rounded-md border p-2 text-xs'>
                              <div className='mb-1 font-medium'>
                                Step {step.stepNumber} — {step.toolName}
                              </div>
                              <div className='text-muted-foreground'>Input</div>
                              <pre className='overflow-x-auto whitespace-pre-wrap'>{JSON.stringify(step.input, null, 2)}</pre>
                              <div className='text-muted-foreground mt-1'>Output</div>
                              <pre className='overflow-x-auto whitespace-pre-wrap'>{JSON.stringify(step.output, null, 2)}</pre>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              )}

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
