import PageContainer from '@/components/layout/page-container';
import type { Metadata } from 'next';
import { PlanHistoryView } from '@/features/maintenance/plan-history-view';

export const metadata: Metadata = {
    title: 'Dashboard: Plan History'
};

export default function PlanHistoryPage() {
    return (
        <PageContainer
            scrollable
            pageTitle='Plan History'
            pageDescription='Review all generated, approved, and rejected maintenance plans.'
        >
            <div className='mx-auto w-full max-w-6xl py-4'>
                <PlanHistoryView />
            </div>
        </PageContainer>
    );
}
