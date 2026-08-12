import { Suspense } from 'react';
import PageContainer from '@/components/layout/page-container';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { DiagnosticsListing } from '@/features/diagnostics/components/diagnostics-listing';

export const metadata = {
  title: 'Dashboard: Active Alerts',
};

export default function Page() {
  return (
    <PageContainer
      scrollable={false}
      pageTitle='Active Alerts'
      pageDescription='Fault diagnoses awaiting human review before any dispatch action is taken.'
    >
      <Suspense fallback={<DataTableSkeleton columnCount={7} rowCount={6} />}>
        <DiagnosticsListing />
      </Suspense>
    </PageContainer>
  );
}
