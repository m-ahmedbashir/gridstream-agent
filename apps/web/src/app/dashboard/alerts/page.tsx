import PageContainer from '@/components/layout/page-container';
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
      {/* DiagnosticsListing is a client component managing its own loading
          state via TanStack Query — no <Suspense> boundary here, since a
          plain useQuery() never suspends (that's useSuspenseQuery's job). */}
      <DiagnosticsListing />
    </PageContainer>
  );
}
