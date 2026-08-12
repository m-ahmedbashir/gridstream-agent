'use client';

import { useState } from 'react';
import { getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import type { FaultDiagnostic } from '@gridstream/shared';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { useDiagnosticsQuery } from '../hooks/use-diagnostics';
import { columns } from './columns';

type StatusFilter = FaultDiagnostic['status'] | 'ALL';

const TABS: { value: StatusFilter; label: string }[] = [
  { value: 'PENDING_APPROVAL', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
];

export function DiagnosticsListing() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING_APPROVAL');
  const { data, isLoading, isError, error } = useDiagnosticsQuery(statusFilter === 'ALL' ? undefined : statusFilter);

  // Client-side pagination over the fetched page (limit=100, per
  // use-diagnostics.ts) — the backend already supports offset-based
  // pagination if a fleet ever outgrows a single fetched page; the UI
  // doesn't need that complexity for an initial deployment.
  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <DataTableSkeleton columnCount={columns.length} rowCount={6} />
      ) : isError ? (
        <div className='text-destructive rounded-md border p-4 text-sm'>
          Failed to load alerts: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      ) : (
        <DataTable table={table} />
      )}
    </div>
  );
}
