import { SettingsForm } from '@/features/extraction-settings/components/settings-form';

export const metadata = {
  title: 'Extraction Settings | OPP Agent',
  description: 'Configure how invoices are extracted and saved'
};

export default function ExtractionSettingsPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Extraction Settings</h1>
        <p className='text-muted-foreground mt-2'>
          Choose your preferred workflow for processing invoices
        </p>
      </div>

      <SettingsForm />

      <div className='rounded-lg border bg-card p-4 space-y-3'>
        <h2 className='font-semibold'>About Extraction Modes</h2>
        <div className='space-y-2 text-sm text-muted-foreground'>
          <div>
            <p className='font-medium text-foreground'>Auto-Approve</p>
            <p>Invoices are extracted and automatically saved to the database without requiring your review.</p>
          </div>
          <div>
            <p className='font-medium text-foreground'>Manual Review</p>
            <p>After extraction, you can review and edit the extracted data before saving. Perfect for ensuring accuracy.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
