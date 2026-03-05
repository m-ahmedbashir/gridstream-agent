import { Injectable, Logger, UnsupportedMediaTypeException } from '@nestjs/common';
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
    /** Original file info */
    file: ProcessedFile;
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
    async processFile(file: Express.Multer.File): Promise<ExtractionResult> {
        this.logger.log(`Processing file: ${file.originalname} (${file.mimetype})`);

        this.validateMimeType(file.mimetype);

        // Step 1 — Extract raw text from the file buffer
        const rawText = this.extractText(file);

        // Step 2 — Mask PII before sending to any external service
        const maskedText = this.complianceService.mask(rawText);
        const piiDetected = maskedText !== rawText;

        if (piiDetected) {
            this.logger.warn(
                `PII detected and masked in file: ${file.originalname}`,
            );
        }

        // Step 3 — Send masked content to Gemini
        const geminiResponse = await this.callGemini(maskedText, file.mimetype);

        const result: ExtractionResult = {
            file: {
                originalName: file.originalname,
                mimeType: file.mimetype,
                sizeBytes: file.size,
            },
            maskedText,
            piiDetected,
            geminiResponse,
            processedAt: new Date().toISOString(),
        };

        this.logger.log(`Extraction complete for: ${file.originalname}`);
        return result;
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    /**
     * Decodes the file buffer to a UTF-8 string.
     * For binary formats (PDF, images) this returns a placeholder; in production
     * you would integrate a PDF parsing library (e.g. pdf-parse) or a vision API.
     */
    private extractText(file: Express.Multer.File): string {
        const textMimes = new Set(['text/plain', 'text/csv', 'application/json']);

        if (textMimes.has(file.mimetype)) {
            return file.buffer.toString('utf-8');
        }

        // For binary types: return a structured placeholder.
        // TODO: integrate pdf-parse for 'application/pdf', use Gemini vision for images.
        this.logger.debug(
            `Binary MIME type (${file.mimetype}) — using buffer placeholder for extraction.`,
        );
        return `[Binary content: ${file.originalname}, ${file.size} bytes, type: ${file.mimetype}]`;
    }

    /**
     * Sends the sanitised text to Gemini via the Vercel AI SDK.
     */
    private async callGemini(
        sanitisedText: string,
        mimeType: string,
    ): Promise<Invoice> {
        const prompt = this.buildExtractionPrompt(sanitisedText, mimeType);

        const { object } = await generateObject({
            model: google('gemini-2.0-flash'),
            schema: InvoiceSchema as any,
            prompt,
        });

        return object as Invoice;
    }

    /**
     * Builds a deterministic extraction prompt for Gemini.
     */
    private buildExtractionPrompt(text: string, mimeType: string): string {
        return `You are an intelligent invoice processing assistant.

The following content has been extracted from an uploaded file (type: ${mimeType}).
Note: Any PII has already been redacted and replaced with [REDACTED:<type>] tokens — do NOT attempt to recover them.

Document content:
---
${text}
---`;
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
