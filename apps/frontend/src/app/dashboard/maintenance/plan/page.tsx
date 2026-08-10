import PageContainer from '@/components/layout/page-container';
import type { Metadata } from 'next';
import { PlanView } from '@/features/maintenance/plan-view';

export const metadata: Metadata = {
    title: 'Dashboard: Maintenance Plan'
};

export default function PlanPage() {
    return (
        <PageContainer
            scrollable
            pageTitle='Maintenance Project Plan'
            pageDescription='Review the generated plan, executive summary, and ROI before approving.'
        >
            <div className='mx-auto w-full max-w-6xl py-4'>
                <PlanView />
            </div>
        </PageContainer>
    );
}
