import { SettingsForm } from '@/features/extraction-settings/components/settings-form';

export const metadata = {
  title: 'Settings | maintain-agent',
  description: 'Configure plan approval, AI model, and processing mode preferences'
};

export default function SettingsPage() {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-3xl font-bold tracking-tight'>Settings</h1>
        <p className='text-muted-foreground mt-2'>
          Choose your preferred workflow for maintenance plan generation and AI processing
        </p>
      </div>

      <SettingsForm />

      <div className='rounded-lg border bg-card p-4 space-y-3'>
        <h2 className='font-semibold'>About Approval Modes</h2>
        <div className='space-y-2 text-sm text-muted-foreground'>
          <div>
            <p className='font-medium text-foreground'>Auto-Approve</p>
            <p>Low-risk items are processed automatically without requiring your review.</p>
          </div>
          <div>
            <p className='font-medium text-foreground'>Manual Review</p>
            <p>After extraction or plan generation, you can review the result before it is persisted.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
