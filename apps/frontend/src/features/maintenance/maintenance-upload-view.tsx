'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/file-uploader';
import { useExtractMaintenance } from './use-extract-maintenance';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { IconUpload, IconX, IconTextCaption } from '@tabler/icons-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import type { MachineProfile, MachineProfileConfidence } from '@maintain/shared';

function CriticalityBadge({ criticality }: { criticality: string }) {
    const variants: Record<string, string> = {
        low: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
        medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
        high: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
        critical: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    };
    return <Badge className={variants[criticality] ?? variants.medium}>{criticality}</Badge>;
}

function confidenceStyle(value: number): string {
    if (value >= 0.8) return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400';
    if (value >= 0.4) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400';
    return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
}

/** One of the six fixed anchors the extraction prompt is forced to use — see MaintenanceExtractionService. */
function ConfidenceChip({ label, value }: { label: string; value: number }) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${confidenceStyle(value)}`}>
            {label}
            <span className='font-mono tabular-nums opacity-80'>{Math.round(value * 100)}%</span>
        </span>
    );
}

const CONFIDENCE_FIELD_LABELS: Record<keyof MachineProfileConfidence, string> = {
    machineId: 'Machine ID',
    machineType: 'Type',
    manufacturer: 'Manufacturer',
    yearInstalled: 'Year Installed',
    runtimeHours: 'Runtime Hours',
    lastServiceDate: 'Last Service',
    observedIssues: 'Observed Issues',
    energyConsumptionKwh: 'Energy Consumption',
    criticality: 'Criticality',
    location: 'Location',
};

function MachineProfileCard({
    profile,
    machineProfileId,
    confidence,
    avgConfidence,
}: {
    profile: MachineProfile;
    machineProfileId: string;
    confidence: MachineProfileConfidence;
    avgConfidence: number;
}) {
    const router = useRouter();

    return (
        <Card>
            <CardHeader>
                <CardTitle className='flex items-center justify-between'>
                    <span>{profile.manufacturer} — {profile.machineId}</span>
                    <div className='flex items-center gap-2'>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${confidenceStyle(avgConfidence)}`}>
                            Overall confidence
                            <span className='font-mono tabular-nums opacity-80'>{Math.round(avgConfidence * 100)}%</span>
                        </span>
                        <CriticalityBadge criticality={profile.criticality} />
                    </div>
                </CardTitle>
                <CardDescription>
                    {profile.machineType} • {profile.runtimeHours.toLocaleString('de-DE')} h • {profile.yearInstalled}
                </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
                <div className='grid grid-cols-2 gap-4 text-sm'>
                    <div>
                        <p className='text-muted-foreground'>Location</p>
                        <p className='font-medium'>{profile.location ?? '—'}</p>
                    </div>
                    <div>
                        <p className='text-muted-foreground'>Energy consumption</p>
                        <p className='font-medium'>{profile.energyConsumptionKwh ?? '—'} kWh/h</p>
                    </div>
                    <div>
                        <p className='text-muted-foreground'>Last service</p>
                        <p className='font-medium'>{profile.lastServiceDate ?? '—'}</p>
                    </div>
                </div>
                <div>
                    <p className='text-muted-foreground mb-2'>Observed issues</p>
                    <div className='flex flex-wrap gap-2'>
                        {profile.observedIssues.map((issue, i) => (
                            <span key={i} className='text-xs rounded-full bg-secondary px-2.5 py-1'>{issue}</span>
                        ))}
                    </div>
                </div>
                <div>
                    <p className='text-muted-foreground mb-2'>
                        Extraction confidence <span className='text-xs'>(per field — six fixed anchors, not a free-floating guess)</span>
                    </p>
                    <div className='flex flex-wrap gap-2'>
                        {(Object.keys(CONFIDENCE_FIELD_LABELS) as (keyof MachineProfileConfidence)[]).map((field) => (
                            <ConfidenceChip key={field} label={CONFIDENCE_FIELD_LABELS[field]} value={confidence[field]} />
                        ))}
                    </div>
                </div>
                <div className='flex gap-2'>
                    <Button onClick={() => router.push(`/dashboard/maintenance/measures?machineProfileId=${machineProfileId}`)}>
                        Find Measures
                    </Button>
                    <Button
                        variant='outline'
                        onClick={() => router.push(`/dashboard/maintenance/live?machineProfileId=${machineProfileId}`)}
                    >
                        Live Monitoring
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

type ExtractionOutcome =
    | {
        status: 'success';
        fileName: string;
        profile: MachineProfile;
        machineProfileId: string;
        confidence: MachineProfileConfidence;
        avgConfidence: number;
    }
    | { status: 'error'; fileName: string; message: string };

// Bounded, not unlimited — the free-tier AI keys behind extraction rate-limit,
// so firing all uploads at once risks 429s instead of finishing faster.
const EXTRACTION_CONCURRENCY = 3;

export function MaintenanceUploadView() {
    const [files, setFiles] = useState<File[]>([]);
    const [pastedText, setPastedText] = useState('');
    const [results, setResults] = useState<ExtractionOutcome[]>([]);

    const { mutateAsync: extractMaintenance, isPending } = useExtractMaintenance();

    const handleUploadFiles = async (filesToUpload: File[]) => {
        setResults([]);
        const outcomes: ExtractionOutcome[] = [];

        for (let i = 0; i < filesToUpload.length; i += EXTRACTION_CONCURRENCY) {
            const batch = filesToUpload.slice(i, i + EXTRACTION_CONCURRENCY);
            const settled = await Promise.allSettled(batch.map((file) => extractMaintenance({ file })));

            settled.forEach((outcome, idx) => {
                const file = batch[idx];
                outcomes.push(
                    outcome.status === 'fulfilled'
                        ? {
                            status: 'success',
                            fileName: file.name,
                            profile: outcome.value.extractedData,
                            machineProfileId: outcome.value.machineProfileId,
                            confidence: outcome.value.confidence,
                            avgConfidence: outcome.value.avgConfidence,
                        }
                        : { status: 'error', fileName: file.name, message: outcome.reason instanceof Error ? outcome.reason.message : 'Extraction failed' },
                );
            });
            // Update after each batch so results appear progressively rather than all at once at the end.
            setResults([...outcomes]);
        }

        setFiles([]);
    };

    const handleTextExtract = async () => {
        if (!pastedText.trim()) return;
        try {
            const res = await extractMaintenance({ text: pastedText });
            setResults([{
                status: 'success',
                fileName: 'pasted text',
                profile: res.extractedData,
                machineProfileId: res.machineProfileId,
                confidence: res.confidence,
                avgConfidence: res.avgConfidence,
            }]);
            setPastedText('');
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="space-y-6 pb-10">
            <Tabs defaultValue="file" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="file">File Upload</TabsTrigger>
                    <TabsTrigger value="text">Paste Text</TabsTrigger>
                </TabsList>
                <TabsContent value="file" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Upload Maintenance Report</CardTitle>
                            <CardDescription>Drag and drop or select a maintenance report file to extract machine data.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FileUploader
                                value={files}
                                onValueChange={setFiles}
                                accept={{
                                    'application/pdf': ['.pdf'],
                                    'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
                                    'text/plain': ['.txt'],
                                    'text/csv': ['.csv'],
                                }}
                                maxFiles={5}
                                maxSize={10 * 1024 * 1024}
                                disabled={isPending}
                            />
                            {files.length > 0 && (
                                <div className='flex items-center justify-end gap-2'>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => setFiles([])}
                                        disabled={isPending}
                                        className='h-8 gap-1 px-3 text-xs'
                                    >
                                        <IconX className='h-3.5 w-3.5' />
                                        Clear files
                                    </Button>
                                    <Button
                                        size='sm'
                                        onClick={() => handleUploadFiles(files)}
                                        disabled={isPending}
                                        className='h-8 px-4 text-xs'
                                    >
                                        {isPending ? 'Processing...' : (
                                            <>
                                                <IconUpload className='mr-1.5 h-3.5 w-3.5' />
                                                Extract Machine Data
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="text" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Paste Maintenance Report</CardTitle>
                            <CardDescription>Copy and paste raw maintenance report text here.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                placeholder='Paste your maintenance report here...'
                                className='min-h-[250px] resize-none font-mono text-sm shadow-sm'
                                value={pastedText}
                                onChange={(e) => setPastedText(e.target.value)}
                                disabled={isPending}
                            />
                            {pastedText.trim().length > 0 && (
                                <div className='flex items-center justify-end gap-2'>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => setPastedText('')}
                                        disabled={isPending}
                                        className='h-8 gap-1 px-3 text-xs'
                                    >
                                        <IconX className='h-3.5 w-3.5' />
                                        Clear text
                                    </Button>
                                    <Button
                                        size='sm'
                                        onClick={handleTextExtract}
                                        disabled={isPending}
                                        className='h-8 px-4 text-xs'
                                    >
                                        {isPending ? 'Processing...' : (
                                            <>
                                                <IconTextCaption className='mr-1.5 h-3.5 w-3.5' />
                                                Extract Machine Data
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {results.length > 0 && (
                <div className="space-y-6 mt-8">
                    <h3 className="text-xl font-semibold tracking-tight">
                        Extracted Machine Profile{results.length > 1 ? 's' : ''}
                    </h3>
                    {results.map((outcome, i) =>
                        outcome.status === 'success' ? (
                            <div key={i} className='space-y-2'>
                                <p className='text-sm text-muted-foreground'>{outcome.fileName}</p>
                                <MachineProfileCard
                                    profile={outcome.profile}
                                    machineProfileId={outcome.machineProfileId}
                                    confidence={outcome.confidence}
                                    avgConfidence={outcome.avgConfidence}
                                />
                            </div>
                        ) : (
                            <Card key={i} className='border-red-200 dark:border-red-900'>
                                <CardContent className='p-4 space-y-1'>
                                    <p className='text-sm font-medium'>{outcome.fileName}</p>
                                    <p className='text-sm text-red-600'>{outcome.message}</p>
                                </CardContent>
                            </Card>
                        ),
                    )}
                </div>
            )}
        </div>
    );
}
