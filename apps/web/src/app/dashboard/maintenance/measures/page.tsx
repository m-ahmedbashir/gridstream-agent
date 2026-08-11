import PageContainer from '@/components/layout/page-container';
import type { Metadata } from 'next';
import { MeasuresView } from '@/features/maintenance/measures-view';

export const metadata: Metadata = {
    title: 'Dashboard: Matched Measures'
};

export default function MeasuresPage() {
    return (
        <PageContainer
            scrollable
            pageTitle='Matched Measures'
            pageDescription='Select the best maintenance measures for this machine and generate a project plan.'
        >
            <div className='mx-auto w-full max-w-6xl py-4'>
                <MeasuresView />
            </div>
        </PageContainer>
    );
}
