'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { FaultDiagnosticWithDevice } from '@gridstream/shared';
import { Badge } from '@/components/ui/badge';
import { DiagnosticActions } from './diagnostic-actions';

const SEVERITY_VARIANT: Record<FaultDiagnosticWithDevice['severity'], 'outline' | 'secondary' | 'destructive'> = {
  LOW: 'outline',
  MEDIUM: 'secondary',
  HIGH: 'destructive',
  CRITICAL: 'destructive',
};

export const columns: ColumnDef<FaultDiagnosticWithDevice>[] = [
  {
    accessorKey: 'severity',
    header: 'SEVERITY',
    cell: ({ row }) => <Badge variant={SEVERITY_VARIANT[row.original.severity]}>{row.original.severity}</Badge>,
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
  },
  {
    accessorKey: 'summary',
    header: 'SUMMARY',
    cell: ({ row }) => <div className='max-w-md truncate'>{row.original.summary}</div>,
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
