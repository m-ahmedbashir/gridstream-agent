import PageContainer from '@/components/layout/page-container';
import { DiagnosticDetail } from '@/features/diagnostics/components/diagnostic-detail';

export const metadata = {
  title: 'Dashboard: Alert Detail',
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PageContainer scrollable pageTitle='Alert Detail' pageDescription='Full diagnosis, device telemetry, and the approve/reject decision.'>
      <DiagnosticDetail id={id} />
    </PageContainer>
  );
}
