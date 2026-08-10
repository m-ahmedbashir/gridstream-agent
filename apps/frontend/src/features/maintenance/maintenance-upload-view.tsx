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
import type { MachineProfile } from '@maintain/shared';

function CriticalityBadge({ criticality }: { criticality: string }) {
    const variants: Record<string, string> = {
        low: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
        medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
        high: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
        critical: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
    };
    return <Badge className={variants[criticality] ?? variants.medium}>{criticality}</Badge>;
}

function MachineProfileCard({ profile, machineProfileId }: { profile: MachineProfile; machineProfileId: string }) {
    const router = useRouter();

    return (
        <Card>
            <CardHeader>
                <CardTitle className='flex items-center justify-between'>
                    <span>{profile.manufacturer} — {profile.machineId}</span>
                    <CriticalityBadge criticality={profile.criticality} />
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
                <Button onClick={() => router.push(`/dashboard/maintenance/measures?machineProfileId=${machineProfileId}`)}>
                    Find Measures
                </Button>
            </CardContent>
        </Card>
    );
}

export function MaintenanceUploadView() {
    const [files, setFiles] = useState<File[]>([]);
    const [pastedText, setPastedText] = useState('');
    const [result, setResult] = useState<{ profile: MachineProfile; machineProfileId: string } | null>(null);

    const { mutateAsync: extractMaintenance, isPending } = useExtractMaintenance();

    const handleUploadFiles = async (filesToUpload: File[]) => {
        try {
            for (const file of filesToUpload) {
                const res = await extractMaintenance({ file });
                setResult({ profile: res.extractedData, machineProfileId: res.machineProfileId });
            }
            setFiles([]);
        } catch (error) {
            console.error(error);
        }
    };

    const handleTextExtract = async () => {
        if (!pastedText.trim()) return;
        try {
            const res = await extractMaintenance({ text: pastedText });
            setResult({ profile: res.extractedData, machineProfileId: res.machineProfileId });
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

            {result && (
                <div className="space-y-6 mt-8">
                    <h3 className="text-xl font-semibold tracking-tight">Extracted Machine Profile</h3>
                    <MachineProfileCard profile={result.profile} machineProfileId={result.machineProfileId} />
                </div>
            )}
        </div>
    );
}
