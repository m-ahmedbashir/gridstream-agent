import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import type { MachineProfile, MachineProfileConfidence } from '@maintain/shared';

export interface MaintenanceExtractionResult {
    originalFileName: string;
    mimeType: string;
    maskedText: string;
    piiDetected: boolean;
    imagePiiDetected: boolean;
    ocrUsed: boolean;
    extractedData: MachineProfile;
    machineProfileId: string;
    confidence: MachineProfileConfidence;
    avgConfidence: number;
    processedAt: string;
    processingTimeMs: number;
    sourceType: string;
    logId: string;
}

export type ExtractMaintenanceVariables = {
    file?: File;
    text?: string;
    processingMode?: string;
    /** Per-upload override — falls back to the user's saved Settings model when omitted. */
    modelKey?: string;
};

async function uploadMaintenanceRequest(
    variables: ExtractMaintenanceVariables,
    userId: string,
): Promise<MaintenanceExtractionResult> {
    const { file, text, processingMode, modelKey } = variables;
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (text) formData.append('text', text);
    if (processingMode) formData.append('processingMode', processingMode);
    if (modelKey) formData.append('modelKey', modelKey);
    formData.append('userId', userId);

    const itemName = file ? file.name : 'pasted text';

    const response = await fetch('http://localhost:3001/maintenance/extract', {
        method: 'POST',
        body: formData,
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

    return response.json();
}

export function useExtractMaintenance() {
    const { userId } = useAuth();

    return useMutation({
        mutationFn: (variables: ExtractMaintenanceVariables) => {
            const currentUserId = userId || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null) || 'default-user';
            return uploadMaintenanceRequest(variables, currentUserId);
        },
        onSuccess: (_, variables) => {
            const itemName = variables.file ? variables.file.name : 'pasted text';
            toast.success(`Extracted maintenance report for ${itemName}`);
        },
        onError: (error, variables) => {
            const itemName = variables.file ? variables.file.name : 'pasted text';
            toast.error(error instanceof Error ? error.message : `Upload failed for ${itemName}`);
        },
    });
}
