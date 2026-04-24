'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/file-uploader';
import { ExtractionResultCard, ExtractionResultData } from '@/features/extraction-settings/components/extraction-result-card';
import { useExtractInvoice } from '@/features/invoice-upload/use-extract-invoice';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { IconUpload, IconX, IconTextCaption } from '@tabler/icons-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function UploadView() {
    const [files, setFiles] = useState<File[]>([]);
    const [pastedText, setPastedText] = useState('');
    const [results, setResults] = useState<ExtractionResultData[]>([]);

    const { mutateAsync: extractInvoice, isPending } = useExtractInvoice();

    const handleUploadFiles = async (filesToUpload: File[]) => {
        try {
            const newResults: ExtractionResultData[] = [];
            for (const file of filesToUpload) {
                const result = await extractInvoice({ file });
                newResults.push({ file, result });
            }
            setResults(prev => [...prev, ...newResults]);
            setFiles([]); // Clear the uploaded list upon success
        } catch (error) {
            console.error(error);
        }
    };

    const handleTextExtract = async () => {
        if (!pastedText.trim()) return;
        try {
            const result = await extractInvoice({ text: pastedText });
            setResults(prev => [...prev, { result }]);
            setPastedText('');
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="space-y-8 pb-10">
            <Tabs defaultValue="file" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="file">File Upload</TabsTrigger>
                    <TabsTrigger value="text">Paste Text</TabsTrigger>
                </TabsList>
                <TabsContent value="file" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Upload Invoice File</CardTitle>
                            <CardDescription>Drag and drop or select an invoice file to extract data.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FileUploader
                                value={files}
                                onValueChange={setFiles}
                                accept={{
                                    'application/pdf': ['.pdf'],
                                    'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
                                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                                    'text/csv': ['.csv']
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
                                                Extract File Data
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
                            <CardTitle>Paste Invoice Content</CardTitle>
                            <CardDescription>Copy and paste your raw JSON, CSV, or text invoice blocks here.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                placeholder='Paste your text here...'
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
                                                <IconUpload className='mr-1.5 h-3.5 w-3.5' />
                                                Extract Text Data
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
                    <h3 className="text-xl font-semibold tracking-tight">Extraction Results</h3>
                    {results.map((res, i) => (
                        <ExtractionResultCard key={i} data={res} />
                    ))}
                </div>
            )}
        </div>
    );
}
