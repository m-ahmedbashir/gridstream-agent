import { Injectable, Logger, UnsupportedMediaTypeException, HttpException, HttpStatus } from '@nestjs/common';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { ComplianceService } from '../compliance/compliance.service';
import { type Invoice } from '@opp/shared';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProcessedFile {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
}

export interface ExtractionResult {
    /** Original file info (omitted if only text was pasted) */
    file?: ProcessedFile;
    maskedText: string;
    piiDetected: boolean;
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
    private readonly groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

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

        let geminiResponse: Invoice;
        try {
            geminiResponse = await this.callGroq(maskedText, mimeTypeToPass, bufferToPass);
        } catch (error) {
            this.logger.error('Failed to extract data via Groq API', error);
            if (error instanceof Error && error.message.includes('429')) {
                throw new HttpException(
                    'Rate limit exceeded. Please try again in a moment.',
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
     * Sends the sanitised text and/or image buffer to Groq and extracts invoice data.
     */
    private async callGroq(
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
                        text: `You are an invoice processing assistant. Extract the invoice data from the document and return ONLY a valid JSON object with these fields:
{
  "invoiceNumber": "string",
  "issueDate": "string",
  "dueDate": "string",
  "vendorName": "string",
  "vendorAddress": "string",
  "customerName": "string",
  "customerAddress": "string",
  "lineItems": [
    {
      "description": "string",
      "quantity": "number",
      "unitPrice": "number",
      "totalPrice": "number"
    }
  ],
  "subtotal": "number",
  "taxAmount": "number",
  "totalAmount": "number",
  "currency": "string"
}

Return ONLY the JSON, no other text. If a field is not found, use null.`
                    }
                ]
            }
        ];

        if (sanitisedText) {
            messages[0].content.push({
                type: 'text',
                text: `\n\nDocument text:\n${sanitisedText}`
            });
        }

        if (buffer) {
            messages[0].content.push({
                type: 'image',
                image: buffer,
                mimeType
            });
        }

        const { text } = await generateText({
            model: this.groq('meta-llama/llama-4-scout-17b-16e-instruct'),
            messages,
        });

        try {
            // Strip markdown code blocks if present
            let jsonText = text.trim();
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
            }
            const parsed = JSON.parse(jsonText);
            return parsed as Invoice;
        } catch (error) {
            this.logger.error('Failed to parse AI response as JSON:', text);
            throw new HttpException(
                'Failed to parse AI response',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
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
