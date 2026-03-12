import PageContainer from '@/components/layout/page-container';
import { FileUploader } from '@/components/upload/file-uploader';
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
            <div className='mx-auto max-w-2xl py-4'>
                <FileUploader />
            </div>
        </PageContainer>
    );
}
