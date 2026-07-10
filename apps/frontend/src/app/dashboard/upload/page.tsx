import PageContainer from '@/components/layout/page-container';
import { UploadView } from './upload-view';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Dashboard: Upload Invoices'
};

export default function UploadPage() {
    return (
        <PageContainer
            scrollable
            pageTitle='Upload Invoices'
            pageDescription='Drag and drop your invoice files (PDF, image, Excel, CSV) to upload them for processing.'
        >
            <div className='mx-auto w-full max-w-5xl py-4'>
                <UploadView />
            </div>
        </PageContainer>
    );
}
