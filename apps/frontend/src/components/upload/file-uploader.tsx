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
    IconAlertTriangle,
    IconTextCaption
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { Invoice } from '@opp/shared';

export interface ExtractionResult {
    originalFileName: string;
    mimeType: string;
    maskedText: string;
    piiDetected: boolean;
    geminiResponse: Invoice;
    processedAt: string;
}

// ---------------------------------------------------------------------------
// HTTP Extraction Service Call
// ---------------------------------------------------------------------------
async function uploadInvoice(file?: File, text?: string): Promise<ExtractionResult> {
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (text) formData.append('text', text);

    const itemName = file ? file.name : 'pasted text';

    const response = await fetch('http://localhost:3001/extraction/upload', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        if (response.status === 413) {
            toast.error(`Payload too large: ${itemName}`);
            throw new Error('Payload exceeds 10MB limit');
        }
        if (response.status === 415) {
            toast.error(`Unsupported representation: ${itemName}`);
            throw new Error('Unsupported format');
        }

        // Attempt to parse NestJS structured error message
        let errorMessage = `Server responded with ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData && errorData.message) {
                errorMessage = errorData.message;
            }
        } catch (_) {
            // Ignore parse errors
        }

        if (response.status === 429) {
            toast.error(errorMessage || 'Quota Exceeded: Gemini API limits reached.');
            throw new Error(errorMessage || 'API Quota Exceeded');
        }

        toast.error(`Upload failed: ${itemName}`);
        throw new Error(errorMessage);
    }

    const data = (await response.json()) as ExtractionResult;
    toast.success(`Extracted data for ${itemName}`);
    return data;
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

interface ExtractedData {
    file?: File;
    result: ExtractionResult;
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
    const [pastedText, setPastedText] = useState('');
    const [globalState, setGlobalState] = useState<UploadState>('idle');
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);

    const handleUploadClick = useCallback(async () => {
        const queue = files.filter((f) => f.state === 'idle' || f.state === 'error');

        // If there are no files but there is text, upload just the text
        if (queue.length === 0 && pastedText.trim().length > 0) {
            setGlobalState('uploading');
            try {
                const result = await uploadInvoice(undefined, pastedText);
                setExtractedData((prev) => [...prev, { result }]);
                setGlobalState('success');
            } catch (err) {
                setGlobalState('error');
            }
            return;
        }

        if (queue.length === 0) return;

        setGlobalState('uploading');

        // Mark queued files as uploading
        setFiles((prev) =>
            prev.map((f) => (queue.some((q) => q.file === f.file) ? { ...f, state: 'uploading', progress: 0 } : f))
        );

        const results = await Promise.allSettled(
            queue.map(async (item) => {
                const { file } = item;
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
                    const result = await uploadInvoice(file, pastedText);
                    setExtractedData((prev) => [...prev, { file, result }]);
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
    }, [files, pastedText]);

    const onDrop = useCallback(
        (accepted: File[], rejected: FileRejection[]) => {
            const errorEntries: UploadedFile[] = rejected.map(({ file, errors }) => ({
                file,
                state: 'error',
                progress: 0,
                errorMessage: errors[0]?.message ?? 'Rejected'
            }));

            const newEntries: UploadedFile[] = accepted.map((file) => ({
                file,
                state: 'idle',
                progress: 0
            }));

            setFiles((prev) => [...prev, ...errorEntries, ...newEntries]);
            if (globalState === 'success' || globalState === 'error') {
                setGlobalState('idle'); // Reset global state when new files are added
            }
        },
        [globalState]
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
        setPastedText('');
        setGlobalState('idle');
        setExtractedData([]);
    }

    const isUploading = globalState === 'uploading';

    return (
        <div className='space-y-4'>
            <Tabs defaultValue='file' className='w-full'>
                <TabsList className='grid w-full grid-cols-2'>
                    <TabsTrigger value='file'>File Upload</TabsTrigger>
                    <TabsTrigger value='text'>Paste Text</TabsTrigger>
                </TabsList>
                <TabsContent value='file' className='mt-4'>
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
                        <div className='mt-4 space-y-2'>
                            <div className='flex items-center justify-between'>
                                <p className='text-sm font-medium text-muted-foreground'>
                                    {files.length} file{files.length > 1 ? 's' : ''}
                                </p>
                                <div className='flex items-center gap-2'>
                                    <Button
                                        size='sm'
                                        onClick={handleUploadClick}
                                        disabled={isUploading || !files.some((f) => f.state === 'idle' || f.state === 'error')}
                                        className='h-7 px-3 text-xs'
                                    >
                                        <IconUpload className='mr-1.5 h-3.5 w-3.5' />
                                        Upload{files.filter((f) => f.state === 'idle' || f.state === 'error').length > 0 ? ` ${files.filter((f) => f.state === 'idle' || f.state === 'error').length}` : ''}
                                    </Button>
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
                            </div>

                            <div className='space-y-2'>
                                {files.map((item, i) => (
                                    <FileUploaderCard key={`${item.file.name}-${i}`} item={item} />
                                ))}
                            </div>
                        </div>
                    )}
                </TabsContent>
                <TabsContent value='text' className='mt-4 space-y-4'>
                    <div className='flex flex-col gap-3'>
                        <div className='flex items-center gap-2 text-sm font-medium text-foreground'>
                            <IconTextCaption className='h-5 w-5 text-muted-foreground' />
                            Paste Invoice Content
                        </div>
                        <p className='text-xs text-muted-foreground'>
                            Copy and paste your raw JSON, CSV, or pure text invoice blocks here. We will apply normal PII extraction before processing.
                        </p>
                        <Textarea
                            placeholder='Paste your text here...'
                            className='min-h-[250px] resize-none font-mono text-sm shadow-sm'
                            value={pastedText}
                            onChange={(e) => setPastedText(e.target.value)}
                            disabled={isUploading}
                        />
                        <div className='flex items-center justify-end gap-2'>
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={clearAll}
                                disabled={isUploading || !pastedText}
                                className='h-8 gap-1 px-3 text-xs'
                            >
                                <IconX className='h-3.5 w-3.5' />
                                Clear text
                            </Button>
                            <Button
                                size='sm'
                                onClick={handleUploadClick}
                                disabled={isUploading || !pastedText.trim()}
                                className='h-8 px-4 text-xs'
                            >
                                {isUploading ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <IconUpload className='mr-1.5 h-3.5 w-3.5' />
                                        Extract Text Data
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Global status banner */}
            {(globalState === 'success' || globalState === 'error') && (
                <div className='mt-4'>
                    {globalState === 'success' && (
                        <div className='flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400'>
                            <IconCheck className='h-4 w-4 shrink-0' />
                            Extraction completed successfully.
                        </div>
                    )}
                    {globalState === 'error' && (
                        <div className='flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive'>
                            <IconAlertTriangle className='h-4 w-4 shrink-0' />
                            Some data failed to process. Check the errors above.
                        </div>
                    )}
                </div>
            )}

            {/* Extracted Data Display */}
            {extractedData.length > 0 && (
                
                <div className='mt-6 space-y-4'>
                    
                     {/* Left Column: Invoice Image */}
                                    {data.file && (
                                        <div className='flex flex-col items-center justify-center bg-muted p-6'>
                                            <div className='w-full overflow-hidden rounded-lg border'>
                                                <img
                                                    src={URL.createObjectURL(data.file)}
                                                    alt='Uploaded invoice'
                                                    className='w-full h-auto'
                                                />
                                            </div>
                                        </div>
                                    )}

                    <h3 className='text-lg font-semibold'>Extracted Invoice Data</h3>
                    {extractedData.map((data, idx) => (
                        <Card key={idx} className='overflow-hidden'>
                            <CardContent className='p-0'>
                                <div className='grid grid-cols-1 md:grid-cols-2 min-h-screen md:min-h-auto'>
                                   
                                    {/* Right Column: Extracted Data */}
                                    <div className='space-y-4 p-6'>
                                        <div>
                                            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>Invoice Details</p>
                                        </div>

                                        <div className='grid grid-cols-2 gap-4'>
                                            <div>
                                                <p className='text-xs font-medium text-muted-foreground'>Invoice Number</p>
                                                <p className='mt-2 text-lg font-semibold'>{data.result.geminiResponse.invoiceNumber || '—'}</p>
                                            </div>
                                            <div>
                                                <p className='text-xs font-medium text-muted-foreground'>Currency</p>
                                                <p className='mt-2 text-lg font-semibold'>{data.result.geminiResponse.currency || '—'}</p>
                                            </div>
                                            <div>
                                                <p className='text-xs font-medium text-muted-foreground'>Issue Date</p>
                                                <p className='mt-2 text-sm'>{data.result.geminiResponse.issueDate || '—'}</p>
                                            </div>
                                            <div>
                                                <p className='text-xs font-medium text-muted-foreground'>Due Date</p>
                                                <p className='mt-2 text-sm'>{data.result.geminiResponse.dueDate || '—'}</p>
                                            </div>
                                        </div>

                                        <div className='border-t pt-4'>
                                            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3'>Vendor</p>
                                            <p className='font-semibold'>{data.result.geminiResponse.vendorName || '—'}</p>
                                            <p className='text-sm text-muted-foreground'>{data.result.geminiResponse.vendorAddress || '—'}</p>
                                        </div>

                                        <div className='border-t pt-4'>
                                            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3'>Customer</p>
                                            <p className='font-semibold'>{data.result.geminiResponse.customerName || '—'}</p>
                                            <p className='text-sm text-muted-foreground'>{data.result.geminiResponse.customerAddress || '—'}</p>
                                        </div>

                                        <div className='border-t pt-4 space-y-3'>
                                            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>Summary</p>
                                            <div className='flex justify-between'>
                                                <span className='text-muted-foreground'>Subtotal:</span>
                                                <span className='font-semibold'>${data.result.geminiResponse.subtotal}</span>
                                            </div>
                                            <div className='flex justify-between'>
                                                <span className='text-muted-foreground'>Tax:</span>
                                                <span className='font-semibold'>${data.result.geminiResponse.taxAmount}</span>
                                            </div>
                                            <div className='flex justify-between border-t pt-3 text-lg font-bold'>
                                                <span>Total:</span>
                                                <span>${data.result.geminiResponse.totalAmount}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Line Items - Full Width Below */}
                                {data.result.geminiResponse.lineItems && data.result.geminiResponse.lineItems.length > 0 && (
                                    <div className='border-t p-6 space-y-4'>
                                        <p className='text-sm font-semibold'>Line Items</p>
                                        <div className='space-y-2'>
                                            {data.result.geminiResponse.lineItems.map((item, itemIdx) => (
                                                <div key={itemIdx} className='flex items-center justify-between rounded-lg border p-3'>
                                                    <div className='flex-1'>
                                                        <p className='font-medium'>{item.description}</p>
                                                        <p className='text-xs text-muted-foreground'>
                                                            {item.quantity} x ${item.unitPrice}
                                                        </p>
                                                    </div>
                                                    <p className='font-semibold'>${item.totalPrice}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
