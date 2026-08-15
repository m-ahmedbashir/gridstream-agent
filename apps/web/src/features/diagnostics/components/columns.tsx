'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { FaultDiagnosticWithDevice } from '@gridstream/shared';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DiagnosticActions } from './diagnostic-actions';

// A shared traffic-light language across every status badge in this
// feature: gray = calm/neutral, amber = caution, orange = warning,
// red = danger/urgent, emerald = good/trustworthy. Built as `variant='outline'`
// + a color className (not new Badge variants) so the shared ui/badge.tsx
// primitive stays untouched — see AGENTS.md's "extend, don't hand-edit"
// rule for shadcn primitives.
export const STATUS_COLOR = {
  neutral: 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400',
  caution: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  warning: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400',
  danger: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
  good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
} as const;

export const SEVERITY_COLOR: Record<FaultDiagnosticWithDevice['severity'], string> = {
  LOW: STATUS_COLOR.neutral,
  MEDIUM: STATUS_COLOR.caution,
  HIGH: STATUS_COLOR.warning,
  CRITICAL: STATUS_COLOR.danger,
};

// LOW gets the same "pay attention" color as a problem, not a pass — a
// low-confidence diagnosis is exactly the case where a human operator's
// scrutiny matters most, so it shouldn't read as reassuring.
export const CONFIDENCE_COLOR: Record<'LOW' | 'MEDIUM' | 'HIGH', string> = {
  LOW: STATUS_COLOR.danger,
  MEDIUM: STATUS_COLOR.caution,
  HIGH: STATUS_COLOR.good,
};

export const ANOMALY_KIND_LABEL: Record<FaultDiagnosticWithDevice['faultType'], string> = {
  THERMAL_RUNAWAY: 'Thermal Runaway',
  VOLTAGE_SAG: 'Voltage Sag',
};

export const columns: ColumnDef<FaultDiagnosticWithDevice>[] = [
  {
    accessorKey: 'severity',
    header: 'SEVERITY',
    cell: ({ row }) => (
      <Badge variant='outline' className={SEVERITY_COLOR[row.original.severity]}>
        {row.original.severity}
      </Badge>
    ),
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
            <Badge variant='outline' className={CONFIDENCE_COLOR[confidenceLabel]}>
              {confidenceLabel}
            </Badge>
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
    cell: ({ row }) => (
      <Badge
        variant='outline'
        className={row.original.requiresImmediateDispatch ? STATUS_COLOR.danger : STATUS_COLOR.neutral}
      >
        {row.original.requiresImmediateDispatch ? 'Immediate' : 'Routine'}
      </Badge>
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
