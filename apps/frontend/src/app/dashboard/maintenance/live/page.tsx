import PageContainer from '@/components/layout/page-container';
import type { Metadata } from 'next';
import { LiveMonitoringView } from '@/features/maintenance/live-monitoring-view';

export const metadata: Metadata = {
    title: 'Dashboard: Live Monitoring'
};

export default function LiveMonitoringPage() {
    return (
        <PageContainer
            scrollable
            pageTitle='Live Monitoring'
            pageDescription='Simulated live telemetry for this machine — anomalies feed straight into the same profile Find Measures reads.'
        >
            <div className='mx-auto w-full max-w-6xl py-4'>
                <LiveMonitoringView />
            </div>
        </PageContainer>
    );
}
