import PageContainer from '@/components/layout/page-container';
import type { Metadata } from 'next';
import { MaintenanceUploadView } from '@/features/maintenance/maintenance-upload-view';

export const metadata: Metadata = {
    title: 'Dashboard: Maintenance Upload'
};

export default function MaintenancePage() {
    return (
        <PageContainer
            scrollable
            pageTitle='Maintenance Reports'
            pageDescription='Upload a German maintenance report (PDF, image, or text) to extract a structured machine profile.'
        >
            <div className='mx-auto w-full max-w-5xl py-4'>
                <MaintenanceUploadView />
            </div>
        </PageContainer>
    );
}
