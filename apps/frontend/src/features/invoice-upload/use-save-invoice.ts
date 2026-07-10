import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Invoice, InvoiceConfidence } from '@opp/shared';

export type SaveInvoiceVariables = {
    invoiceData: Invoice;
    userId: string;
    invoiceId?: string;
    fieldConfidence?: InvoiceConfidence;
    avgConfidence?: number;
};

async function saveInvoiceRequest(variables: SaveInvoiceVariables) {
    const response = await fetch('http://localhost:3001/invoices/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(variables)
    });

    if (!response.ok) {
        let errorMessage = `Server responded with ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData && errorData.message) errorMessage = errorData.message;
        } catch (_) {}
        throw new Error(errorMessage);
    }
    return response.json();
}

export function useSaveInvoice() {
    return useMutation({
        mutationFn: saveInvoiceRequest,
        onSuccess: () => {
            toast.success('Invoice saved successfully');
        },
        onError: (error) => {
            toast.error(error instanceof Error ? error.message : 'Failed to save invoice');
        }
    });
}
