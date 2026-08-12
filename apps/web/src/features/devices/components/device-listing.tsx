'use client';

import { getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { useDevicesQuery } from '../hooks/use-devices';
import { columns } from './columns';

export function DeviceListing() {
  const { data, isLoading, isError, error } = useDevicesQuery();

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (isLoading) {
    return <DataTableSkeleton columnCount={columns.length} rowCount={6} />;
  }

  if (isError) {
    return (
      <div className='text-destructive rounded-md border p-4 text-sm'>
        Failed to load devices: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  return <DataTable table={table} />;
}
