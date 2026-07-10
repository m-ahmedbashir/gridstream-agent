'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, KeyRound, CheckCircle2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings, type ExtractionMode } from '../hooks/useSettings';
import { useModelOptions } from '../hooks/useModelOptions';

const PROVIDER_LABELS: Record<string, string> = {
  groq: 'Groq',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

/**
 * Settings Form Component
 * Lets a user choose their extraction mode (Auto-Approve / Manual Review)
 * and which AI model extraction requests are sent to.
 */
export function SettingsForm() {
  const { settings, loading, error, updateSettings } = useSettings();
  const { models, loading: modelsLoading } = useModelOptions();
  const [selectedMode, setSelectedMode] = useState<ExtractionMode>('MANUAL_REVIEW');
  const [selectedModelKey, setSelectedModelKey] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);

  useEffect(() => {
    if (settings?.extractionMode) {
      setSelectedMode(settings.extractionMode);
    }
    if (settings?.modelKey) {
      setSelectedModelKey(settings.modelKey);
    }
  }, [settings]);

  const hasUnsavedChanges =
    !!settings &&
    (selectedMode !== settings.extractionMode || selectedModelKey !== settings.modelKey);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const success = await updateSettings({
        extractionMode: selectedMode,
        modelKey: selectedModelKey,
      });
      if (success) {
        toast.success('Settings updated');
      } else {
        toast.error('Failed to update settings');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    try {
      setIsSavingApiKey(true);
      const success = await updateSettings({ apiKey: apiKeyInput.trim() });
      if (success) {
        toast.success('API key saved');
        setApiKeyInput('');
        setIsEditingApiKey(false);
      } else {
        toast.error('Failed to save API key');
      }
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const handleRemoveApiKey = async () => {
    try {
      setIsSavingApiKey(true);
      const success = await updateSettings({ apiKey: '' });
      if (success) {
        toast.success('API key removed — extraction will use the shared key again');
      } else {
        toast.error('Failed to remove API key');
      }
    } finally {
      setIsSavingApiKey(false);
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

        <div className='border-t pt-6 space-y-2'>
          <Label htmlFor='model-picker' className='text-base font-semibold'>
            AI Model
          </Label>
          <p className='text-sm text-muted-foreground'>
            Which model reads your invoices. Models without vision support can't process images or scanned PDFs.
          </p>
          <Select
            value={selectedModelKey}
            onValueChange={setSelectedModelKey}
            disabled={modelsLoading || models.length === 0}
          >
            <SelectTrigger id='model-picker' className='w-full sm:w-[320px]'>
              <SelectValue placeholder={modelsLoading ? 'Loading models...' : 'Select a model...'} />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.key} value={model.key}>
                  {PROVIDER_LABELS[model.provider] ?? model.provider} — {model.modelId}
                  {!model.supportsVision && ' (text only)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='border-t pt-6 space-y-3'>
          <div className='flex items-center gap-2'>
            <KeyRound className='h-4 w-4 text-muted-foreground' />
            <Label className='text-base font-semibold'>Your Own API Key (optional)</Label>
          </div>
          <p className='text-sm text-muted-foreground'>
            Bring your own provider key instead of using the shared one. It's encrypted before it's stored, and
            once saved it can't be viewed again here — only replaced or removed.
          </p>

          {settings?.hasApiKey && !isEditingApiKey ? (
            <div className='flex items-center justify-between rounded-lg border p-3'>
              <div className='flex items-center gap-2 text-sm'>
                <CheckCircle2 className='h-4 w-4 text-green-600' />
                <span>A key is saved for this account</span>
              </div>
              <div className='flex gap-2'>
                <Button variant='outline' size='sm' onClick={() => setIsEditingApiKey(true)} disabled={isSavingApiKey}>
                  Replace
                </Button>
                <Button variant='outline' size='sm' onClick={handleRemoveApiKey} disabled={isSavingApiKey}>
                  <Trash2 className='h-3.5 w-3.5' />
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className='flex flex-col sm:flex-row gap-2'>
              <Input
                type='password'
                autoComplete='off'
                placeholder='sk-...'
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                disabled={isSavingApiKey}
                className='flex-1'
              />
              <Button onClick={handleSaveApiKey} disabled={isSavingApiKey || !apiKeyInput.trim()}>
                {isSavingApiKey ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Save Key'}
              </Button>
              {settings?.hasApiKey && (
                <Button
                  variant='ghost'
                  onClick={() => {
                    setIsEditingApiKey(false);
                    setApiKeyInput('');
                  }}
                  disabled={isSavingApiKey}
                >
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className='rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive'>
            {error}
          </div>
        )}

        <div className='flex justify-end gap-2 pt-4'>
          <Button onClick={handleSave} disabled={isSaving || !settings || !hasUnsavedChanges}>
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

        {settings && !hasUnsavedChanges && (
          <p className='text-xs text-muted-foreground text-center'>
            Current: {settings.extractionMode === 'AUTO_APPROVE' ? 'Auto-Approve' : 'Manual Review'} · {settings.modelKey}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
