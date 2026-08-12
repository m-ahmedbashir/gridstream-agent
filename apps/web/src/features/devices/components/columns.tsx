'use client';

import type { ColumnDef } from '@tanstack/react-table';
import type { DeviceAsset } from '@gridstream/shared';
import { Badge } from '@/components/ui/badge';

const STATUS_VARIANT: Record<DeviceAsset['status'], 'default' | 'outline' | 'secondary'> = {
  ONLINE: 'default',
  OFFLINE: 'secondary',
  MAINTENANCE: 'outline',
};

export const columns: ColumnDef<DeviceAsset>[] = [
  { accessorKey: 'deviceType', header: 'TYPE' },
  { accessorKey: 'serialNumber', header: 'SERIAL' },
  {
    accessorKey: 'location',
    header: 'LOCATION',
    cell: ({ row }) => row.original.location ?? 'Unknown',
  },
  {
    accessorKey: 'status',
    header: 'STATUS',
    cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>,
  },
];
