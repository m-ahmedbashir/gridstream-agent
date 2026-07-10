import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/**
 * Zod schema for the multipart upload request.
 * The file itself is provided via @UploadedFile() — this DTO carries
 * any additional metadata fields sent alongside the file.
 */
export const UploadInvoiceSchema = z.object({
    /**
     * Optional hint about the invoice type.
     * e.g. 'vendor', 'customer', 'credit-note'
     */
    invoiceType: z
        .enum(['vendor', 'customer', 'credit-note', 'other'])
        .optional()
        .default('other'),

    /**
     * Optional ISO-4217 currency code for the invoice.
     * e.g. 'USD', 'EUR', 'GBP'
     */
    currency: z.string().length(3).toUpperCase().optional(),

    /**
     * Free-text note from the uploader, surfaced in audit logs.
     */
    notes: z.string().max(500).optional(),

    /**
     * Raw text content provided directly via the UI text area.
     */
    text: z.string().optional(),

    /**
     * Clerk user id, if known — used to look up the caller's saved model
     * preference. Omitted for anonymous/local-dev callers, who get the
     * service's own default model.
     */
    userId: z.string().optional(),
});

export class UploadInvoiceDto extends createZodDto(UploadInvoiceSchema) { }
