'use client';

import { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
    IconUpload,
    IconFile,
    IconX,
    IconCheck,
    IconAlertTriangle
} from '@tabler/icons-react';

// ---------------------------------------------------------------------------
// Placeholder — swap this out for a real fetch() call to your NestJS backend
// ---------------------------------------------------------------------------
async function uploadInvoice(file: File): Promise<void> {
    console.log('[uploadInvoice] uploading:', file.name, file.size, 'bytes');
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1800));
    console.log('[uploadInvoice] done:', file.name);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type UploadState = 'idle' | 'uploading' | 'success' | 'error';

interface UploadedFile {
    file: File;
    state: UploadState;
    progress: number;
    errorMessage?: string;
}

// ---------------------------------------------------------------------------
// FileUploaderCard — individual file row
// ---------------------------------------------------------------------------
function FileUploaderCard({ item }: { item: UploadedFile }) {
    const sizeKb = (item.file.size / 1024).toFixed(1);

    return (
        <div className='flex items-center gap-3 rounded-lg border bg-card px-4 py-3'>
            {/* Icon */}
            <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted'>
                <IconFile className='h-5 w-5 text-muted-foreground' />
            </div>

            {/* File info + progress */}
            <div className='min-w-0 flex-1 space-y-1'>
                <p className='truncate text-sm font-medium leading-none'>
                    {item.file.name}
                </p>
                <p className='text-xs text-muted-foreground'>{sizeKb} KB</p>
                {item.state === 'uploading' && (
                    <Progress value={item.progress} className='h-1.5' />
                )}
                {item.state === 'error' && (
                    <p className='text-xs text-destructive'>{item.errorMessage}</p>
                )}
            </div>

            {/* Status badge */}
            <div className='shrink-0'>
                {item.state === 'uploading' && (
                    <span className='text-xs text-muted-foreground'>
                        {item.progress}%
                    </span>
                )}
                {item.state === 'success' && (
                    <span className='flex items-center gap-1 text-xs font-medium text-green-600'>
                        <IconCheck className='h-4 w-4' />
                        Uploaded
                    </span>
                )}
                {item.state === 'error' && (
                    <IconAlertTriangle className='h-4 w-4 text-destructive' />
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function FileUploader() {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [globalState, setGlobalState] = useState<UploadState>('idle');

    const processFiles = useCallback(async (accepted: File[]) => {
        if (accepted.length === 0) return;

        const newEntries: UploadedFile[] = accepted.map((file) => ({
            file,
            state: 'uploading',
            progress: 0
        }));

        setFiles((prev) => [...prev, ...newEntries]);
        setGlobalState('uploading');

        // Upload each file independently so progress is per-file
        const results = await Promise.allSettled(
            accepted.map(async (file, idx) => {
                // Fake incremental progress ticks
                const tickInterval = setInterval(() => {
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.file === file && f.state === 'uploading'
                                ? { ...f, progress: Math.min(f.progress + 20, 90) }
                                : f
                        )
                    );
                }, 300);

                try {
                    await uploadInvoice(file);
                    clearInterval(tickInterval);
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.file === file ? { ...f, state: 'success', progress: 100 } : f
                        )
                    );
                } catch (err) {
                    clearInterval(tickInterval);
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.file === file
                                ? {
                                    ...f,
                                    state: 'error',
                                    errorMessage:
                                        err instanceof Error ? err.message : 'Upload failed'
                                }
                                : f
                        )
                    );
                    throw err;
                }
            })
        );

        const anyError = results.some((r) => r.status === 'rejected');
        setGlobalState(anyError ? 'error' : 'success');
    }, []);

    const onDrop = useCallback(
        (accepted: File[], rejected: FileRejection[]) => {
            if (rejected.length > 0) {
                const errorEntries: UploadedFile[] = rejected.map(({ file, errors }) => ({
                    file,
                    state: 'error',
                    progress: 0,
                    errorMessage: errors[0]?.message ?? 'Rejected'
                }));
                setFiles((prev) => [...prev, ...errorEntries]);
            }
            processFiles(accepted);
        },
        [processFiles]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
                '.xlsx'
            ],
            'text/csv': ['.csv']
        },
        maxSize: 10 * 1024 * 1024, // 10 MB
        multiple: true
    });

    function clearAll() {
        setFiles([]);
        setGlobalState('idle');
    }

    const isUploading = globalState === 'uploading';

    return (
        <div className='space-y-4'>
            {/* Drop zone */}
            <Card>
                <CardContent className='p-0'>
                    <div
                        {...getRootProps()}
                        className={cn(
                            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 text-center transition-colors',
                            isDragActive
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50 hover:bg-muted/40',
                            isUploading && 'pointer-events-none opacity-60'
                        )}
                    >
                        <input {...getInputProps()} />
                        <div
                            className={cn(
                                'flex h-14 w-14 items-center justify-center rounded-full transition-colors',
                                isDragActive ? 'bg-primary/10' : 'bg-muted'
                            )}
                        >
                            <IconUpload
                                className={cn(
                                    'h-6 w-6 transition-colors',
                                    isDragActive ? 'text-primary' : 'text-muted-foreground'
                                )}
                            />
                        </div>

                        {isDragActive ? (
                            <p className='text-sm font-medium text-primary'>
                                Drop your invoices here…
                            </p>
                        ) : (
                            <>
                                <div className='space-y-1'>
                                    <p className='text-sm font-medium'>
                                        Drag &amp; drop invoices, or{' '}
                                        <span className='text-primary underline-offset-2 hover:underline'>
                                            click to browse
                                        </span>
                                    </p>
                                    <p className='text-xs text-muted-foreground'>
                                        PDF, PNG, JPG, XLSX, CSV — up to 10 MB each
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* File list */}
            {files.length > 0 && (
                <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                        <p className='text-sm font-medium text-muted-foreground'>
                            {files.length} file{files.length > 1 ? 's' : ''}
                        </p>
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={clearAll}
                            disabled={isUploading}
                            className='h-7 gap-1 px-2 text-xs text-muted-foreground'
                        >
                            <IconX className='h-3.5 w-3.5' />
                            Clear all
                        </Button>
                    </div>

                    <div className='space-y-2'>
                        {files.map((item, i) => (
                            <FileUploaderCard key={`${item.file.name}-${i}`} item={item} />
                        ))}
                    </div>

                    {/* Global status banner */}
                    {globalState === 'success' && (
                        <div className='flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400'>
                            <IconCheck className='h-4 w-4 shrink-0' />
                            All files uploaded successfully.
                        </div>
                    )}
                    {globalState === 'error' && (
                        <div className='flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive'>
                            <IconAlertTriangle className='h-4 w-4 shrink-0' />
                            Some files failed to upload. Check the errors above.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
