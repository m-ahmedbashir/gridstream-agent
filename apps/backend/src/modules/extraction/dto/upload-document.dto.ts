import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { DOCUMENT_TYPE_KEYS } from '../document-type-registry';

/**
 * Zod schema for the multipart upload request.
 * The file itself is provided via @UploadedFile() — this DTO carries
 * any additional metadata fields sent alongside the file.
 */
export const UploadDocumentSchema = z.object({
    /**
     * Which document-type registry entry to extract with (see document-type-registry.ts).
     * 'auto' (the default) classifies the document against the model instead of
     * requiring the caller to know the type up front.
     */
    documentType: z
        .enum([...DOCUMENT_TYPE_KEYS, 'auto'])
        .optional()
        .default('auto'),

    /**
     * Optional ISO-4217 currency code, when relevant to the document type (e.g. invoice/receipt).
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

    /**
     * How images and scanned PDFs are read.
     * 'vision' — sent as image content parts to a vision-capable model (default).
     * 'local-ocr' — converted to text locally via Tesseract before anything
     *   leaves the server, so image content goes through the same PII-masking
     *   pipeline as typed text.
     * Omitting this field falls back to the service's configured default.
     */
    processingMode: z.enum(['vision', 'local-ocr']).optional(),

});

export class UploadDocumentDto extends createZodDto(UploadDocumentSchema) { }
