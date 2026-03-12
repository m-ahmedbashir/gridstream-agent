import { Injectable, Logger, UnsupportedMediaTypeException, HttpException, HttpStatus } from '@nestjs/common';
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { ComplianceService } from '../compliance/compliance.service';
import { InvoiceSchema, type Invoice } from '@opp/shared';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProcessedFile {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
}

export interface ExtractionResult {
    /** Original file info (omitted if only text was pasted) */
    file?: ProcessedFile;
    /** The text that was sent to Gemini (PII already masked) */
    maskedText: string;
    /** Whether any PII was detected and masked before sending */
    piiDetected: boolean;
    /** Gemini's structured extraction output, strongly typed to the shared Invoice schema */
    geminiResponse: Invoice;
    /** ISO timestamp of when the extraction completed */
    processedAt: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * ExtractionService
 *
 * Orchestrates the full invoice extraction pipeline:
 *   1. Decode the uploaded file buffer into text.
 *   2. Mask PII via ComplianceService before touching any external service.
 *   3. Send the sanitised content to Gemini with a structured extraction prompt.
 *   4. Return a typed ExtractionResult.
 */
@Injectable()
export class ExtractionService {
    private readonly logger = new Logger(ExtractionService.name);

    /** Supported MIME types for text extraction */
    private static readonly SUPPORTED_MIME_TYPES = new Set([
        'text/plain',
        'text/csv',
        'application/json',
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
    ]);

    constructor(private readonly complianceService: ComplianceService) { }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Main entry point called by ExtractionController.
     *
     * @param file - Multer file object from the multipart upload.
     * @returns A fully structured ExtractionResult.
     */
    async processFile(
        file?: Express.Multer.File,
        textPayload?: string,
    ): Promise<ExtractionResult> {
        this.logger.log(
            `Processing submission: file=${file?.originalname ?? 'none'}, text=${textPayload ? 'provided' : 'none'}`
        );

        if (!file && !textPayload) {
            throw new HttpException('Must provide either a file or a text payload', HttpStatus.BAD_REQUEST);
        }

        if (file) {
            this.validateMimeType(file.mimetype);
        }

        // Step 1 — Extract raw text from the file buffer, append pasted text
        const extractedFileText = file ? this.extractText(file) : '';
        const rawText = [extractedFileText, textPayload].filter(Boolean).join('\n\n--- PASTED TEXT ---\n\n');

        // Step 2 — Mask PII before sending to any external service
        const maskedText = rawText ? this.complianceService.mask(rawText) : '';
        const piiDetected = maskedText !== rawText;

        if (piiDetected) {
            this.logger.warn(`PII detected and masked in request.`);
        }

        const isImage = file?.mimetype.startsWith('image/');
        const bufferToPass = isImage ? file?.buffer : undefined;
        const mimeTypeToPass = file?.mimetype ?? 'text/plain';

        // Step 3 — Send masked content to Gemini
        let geminiResponse: Invoice;
        try {
            geminiResponse = await this.callGemini(maskedText, mimeTypeToPass, bufferToPass);
        } catch (error) {
            this.logger.error('Failed to extract data via Gemini API', error);
            if (error instanceof Error && (error.message.includes('Quota exceeded') || error.message.includes('429'))) {
                throw new HttpException(
                    'Quota Exceeded: The Gemini API free tier limits have been reached. Please try again later or add a billing account.',
                    HttpStatus.TOO_MANY_REQUESTS
                );
            }
            throw new HttpException(
                'Failed to process file through AI extraction engine.',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }

        const result: ExtractionResult = {
            ...(file && {
                file: {
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    sizeBytes: file.size,
                }
            }),
            maskedText,
            piiDetected,
            geminiResponse,
            processedAt: new Date().toISOString(),
        };

        this.logger.log(`Extraction complete.`);
        return result;
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    /**
     * Decodes the file buffer to a UTF-8 string.
     * For binary formats (PDF, images) this returns an empty string to defer to Vision.
     */
    private extractText(file: Express.Multer.File): string {
        const textMimes = new Set(['text/plain', 'text/csv', 'application/json']);

        if (textMimes.has(file.mimetype)) {
            return file.buffer.toString('utf-8');
        }

        this.logger.debug(
            `Handling binary MIME type (${file.mimetype}). Text extraction skipped or deferred to vision model.`,
        );
        return '';
    }

    /**
     * Sends the sanitised text and/or image buffer to Gemini via the Vercel AI SDK.
     */
    private async callGemini(
        sanitisedText: string,
        mimeType: string,
        buffer?: Buffer,
    ): Promise<Invoice> {
        const messages: any[] = [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: 'You are an intelligent invoice processing assistant.\n\nExtract the requested invoice attributes from the following document. Note: Any PII in the text has already been redacted and replaced with [REDACTED:<type>] tokens — do NOT attempt to recover them.'
                    }
                ]
            }
        ];

        if (sanitisedText) {
            messages[0].content.push({
                type: 'text',
                text: `\n\nDocument text content:\n---\n${sanitisedText}\n---`
            });
        }

        if (buffer) {
            messages[0].content.push({
                type: 'image',
                image: buffer,
                mimeType
            });
        }

        const { object } = await generateObject({
            model: google('gemini-2.0-flash-lite'),
            schema: InvoiceSchema as any,
            messages,
        });

        return object as Invoice;
    }

    /** Guard against unsupported MIME types early, before any processing. */
    private validateMimeType(mimeType: string): void {
        if (!ExtractionService.SUPPORTED_MIME_TYPES.has(mimeType)) {
            throw new UnsupportedMediaTypeException(
                `Unsupported file type: ${mimeType}. Accepted types: ${[...ExtractionService.SUPPORTED_MIME_TYPES].join(', ')}`,
            );
        }
    }
}
