'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings, type ExtractionMode } from '../hooks/useSettings';

/**
 * Settings Form Component
 * Allows users to choose between Auto-Approve and Manual-Review extraction modes
 */
export function SettingsForm() {
  const { settings, loading, error, updateSettings } = useSettings();
  const [selectedMode, setSelectedMode] = useState<ExtractionMode>('MANUAL_REVIEW');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings?.extractionMode) {
      setSelectedMode(settings.extractionMode);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const success = await updateSettings(selectedMode);
      if (success) {
        toast.success(`Extraction mode updated to ${selectedMode === 'AUTO_APPROVE' ? 'Auto-Approve' : 'Manual Review'}`);
      } else {
        toast.error('Failed to update extraction mode');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center py-8'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extraction Settings</CardTitle>
        <CardDescription>
          Choose how extracted invoice data should be processed
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        <RadioGroup value={selectedMode} onValueChange={(value) => setSelectedMode(value as ExtractionMode)}>
          {/* Auto-Approve Option */}
          <div className='flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent cursor-pointer transition-colors'>
            <RadioGroupItem value='AUTO_APPROVE' id='auto-approve' className='mt-1' />
            <div className='flex-1'>
              <Label htmlFor='auto-approve' className='text-base font-semibold cursor-pointer'>
                Auto-Approve
              </Label>
              <p className='text-sm text-muted-foreground mt-1'>
                Extract and save automatically. No review step — data is saved immediately.
              </p>
            </div>
          </div>

          {/* Manual Review Option */}
          <div className='flex items-start space-x-3 rounded-lg border p-4 hover:bg-accent cursor-pointer transition-colors'>
            <RadioGroupItem value='MANUAL_REVIEW' id='manual-review' className='mt-1' />
            <div className='flex-1'>
              <Label htmlFor='manual-review' className='text-base font-semibold cursor-pointer'>
                Manual Review
              </Label>
              <p className='text-sm text-muted-foreground mt-1'>
                Extract and show editable form. Review and edit fields before saving.
              </p>
            </div>
          </div>
        </RadioGroup>

        {error && (
          <div className='rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive'>
            {error}
          </div>
        )}

        <div className='flex justify-end gap-2 pt-4'>
          <Button
            onClick={handleSave}
            disabled={isSaving || !settings || selectedMode === settings.extractionMode}
          >
            {isSaving ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>

        {settings && selectedMode === settings.extractionMode && (
          <p className='text-xs text-muted-foreground text-center'>
            Current mode: {settings.extractionMode === 'AUTO_APPROVE' ? 'Auto-Approve' : 'Manual Review'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
