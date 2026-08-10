import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import type { Invoice, InvoiceConfidence, Receipt, ReceiptConfidence, Resume, ResumeConfidence } from '@maintain/shared';

/** Mirrors DocumentTypeKey in the backend's document-type-registry.ts. */
export type DocumentType = 'invoice' | 'receipt' | 'resume';

export type ExtractedData = Invoice | Receipt | Resume;
export type ExtractedConfidence = InvoiceConfidence | ReceiptConfidence | ResumeConfidence;

export interface ExtractionResult {
    originalFileName: string;
    mimeType: string;
    maskedText: string;
    piiDetected: boolean;
    imagePiiDetected: boolean;
    /** Which document-type registry entry was used — the caller's override or the auto-classified type. */
    documentType: DocumentType;
    extractedData: ExtractedData;
    confidence: ExtractedConfidence;
    avgConfidence: number;
    processedAt: string;
    processingTimeMs: number;
    sourceType: string;
    logId: string;
}

export type ExtractInvoiceVariables = {
    file?: File;
    text?: string;
};

async function uploadInvoiceRequest(variables: ExtractInvoiceVariables, userId: string): Promise<ExtractionResult> {
    const { file, text } = variables;
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (text) formData.append('text', text);
    formData.append('userId', userId); // lets the backend look up the caller's saved model preference

    const itemName = file ? file.name : 'pasted text';

    const response = await fetch('http://localhost:3001/extraction/upload', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        if (response.status === 413) {
            throw new Error(`Payload exceeds 10MB limit: ${itemName}`);
        }
        if (response.status === 415) {
            throw new Error(`Unsupported format: ${itemName}`);
        }

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
            throw new Error(errorMessage || 'API Quota Exceeded');
        }

        throw new Error(errorMessage);
    }

    const data = (await response.json()) as ExtractionResult;
    return data;
}

export function useExtractInvoice() {
    const { userId } = useAuth();

    return useMutation({
        mutationFn: (variables: ExtractInvoiceVariables) => {
            // Same resolution order as useSettings.ts's resolveUserId — keep these in sync.
            const currentUserId = userId || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null) || 'default-user';
            return uploadInvoiceRequest(variables, currentUserId);
        },
        onSuccess: (_, variables) => {
            const itemName = variables.file ? variables.file.name : 'pasted text';
            toast.success(`Extracted data for ${itemName}`);
        },
        onError: (error, variables) => {
            const itemName = variables.file ? variables.file.name : 'pasted text';
            toast.error(error instanceof Error ? error.message : `Upload failed for ${itemName}`);
        }
    });
}
