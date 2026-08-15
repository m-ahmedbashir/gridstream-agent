'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { FaultDiagnosticWithDevice } from '@gridstream/shared';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DiagnosticActions } from './diagnostic-actions';

const SEVERITY_VARIANT: Record<FaultDiagnosticWithDevice['severity'], 'outline' | 'secondary' | 'destructive'> = {
  LOW: 'outline',
  MEDIUM: 'secondary',
  HIGH: 'destructive',
  CRITICAL: 'destructive',
};

// LOW is flagged with the same visual weight as a problem, not a pass — a
// low-confidence diagnosis is exactly the case where a human operator's
// scrutiny matters most, so it shouldn't read as reassuring.
export const CONFIDENCE_VARIANT: Record<'LOW' | 'MEDIUM' | 'HIGH', 'destructive' | 'secondary' | 'outline'> = {
  LOW: 'destructive',
  MEDIUM: 'secondary',
  HIGH: 'outline',
};

export const ANOMALY_KIND_LABEL: Record<FaultDiagnosticWithDevice['faultType'], string> = {
  THERMAL_RUNAWAY: 'Thermal Runaway',
  VOLTAGE_SAG: 'Voltage Sag',
};

export const columns: ColumnDef<FaultDiagnosticWithDevice>[] = [
  {
    accessorKey: 'severity',
    header: 'SEVERITY',
    cell: ({ row }) => <Badge variant={SEVERITY_VARIANT[row.original.severity]}>{row.original.severity}</Badge>,
  },
  {
    accessorKey: 'confidenceLabel',
    header: 'CONFIDENCE',
    // Deterministically computed (see apps/api's diagnostic-confidence.ts),
    // never model-reported — null means this row predates confidence
    // scoring, not a real "no confidence" result, so it renders as a plain
    // dash rather than a fabricated badge.
    cell: ({ row }) => {
      const { confidenceLabel, confidenceScore } = row.original;
      if (confidenceLabel == null) {
        return <span className='text-muted-foreground text-xs'>—</span>;
      }
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={CONFIDENCE_VARIANT[confidenceLabel]}>{confidenceLabel}</Badge>
          </TooltipTrigger>
          <TooltipContent>{confidenceScore}/100</TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    id: 'device',
    header: 'DEVICE',
    cell: ({ row }) => (
      <div>
        <div className='font-medium'>{row.original.device.serialNumber}</div>
        <div className='text-muted-foreground text-xs'>{row.original.device.location ?? 'Unknown location'}</div>
      </div>
    ),
  },
  {
    accessorKey: 'faultType',
    header: 'FAULT TYPE',
    cell: ({ row }) => ANOMALY_KIND_LABEL[row.original.faultType],
  },
  {
    accessorKey: 'summary',
    header: 'SUMMARY',
    // Truncated for consistent row height (a table's job is scanning many
    // rows at once), but the full text is one hover away rather than lost —
    // clicking the row also reaches it in full on the detail page.
    cell: ({ row }) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='max-w-md truncate'>{row.original.summary}</div>
        </TooltipTrigger>
        <TooltipContent className='max-w-sm'>{row.original.summary}</TooltipContent>
      </Tooltip>
    ),
  },
  {
    accessorKey: 'requiresImmediateDispatch',
    header: 'DISPATCH',
    cell: ({ row }) =>
      row.original.requiresImmediateDispatch ? (
        <Badge variant='destructive'>Immediate</Badge>
      ) : (
        <Badge variant='outline'>Routine</Badge>
      ),
  },
  {
    accessorKey: 'createdAt',
    header: 'DETECTED',
    // `createdAt` arrives as an ISO string over the wire (JSON has no Date
    // type) even though the shared type says Date — `new Date(...)` handles
    // both a string and an already-real Date safely.
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
  },
  {
    id: 'actions',
    cell: ({ row }) => <DiagnosticActions diagnostic={row.original} />,
  },
];
