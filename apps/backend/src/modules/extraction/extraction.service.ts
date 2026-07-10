import { Injectable, Logger, UnsupportedMediaTypeException, HttpException, HttpStatus } from '@nestjs/common';
import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { PDFParse } from 'pdf-parse';
import { ComplianceService } from '../compliance/compliance.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { type Invoice, type InvoiceConfidence } from '@opp/shared';

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
    extractedInvoice: Invoice;
    confidence: InvoiceConfidence;
    avgConfidence: number;
    processedAt: string;
    processingTimeMs: number;
    sourceType: string;
    logId: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * ExtractionService
 *
 * Orchestrates the full invoice extraction pipeline:
 *   1. Decode the uploaded file buffer into text.
 *   2. Mask PII via ComplianceService before touching any external service.
 *   3. Send the sanitised content to Groq with a structured extraction prompt.
 *   4. Return a typed ExtractionResult.
 */
@Injectable()
export class ExtractionService {
    private readonly logger = new Logger(ExtractionService.name);
    private readonly groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

    private static readonly MIME_TO_SOURCE: Record<string, string> = {
        'text/plain': 'TEXT',
        'text/csv': 'CSV',
        'application/json': 'JSON',
        'application/pdf': 'PDF',
    };

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

    constructor(
        private readonly complianceService: ComplianceService,
        private readonly prisma: PrismaService,
    ) { }

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
        const startTime = Date.now();

        this.logger.log(
            `Processing submission: file=${file?.originalname ?? 'none'}, text=${textPayload ? 'provided' : 'none'}`
        );

        if (!file && !textPayload) {
            throw new HttpException('Must provide either a file or a text payload', HttpStatus.BAD_REQUEST);
        }

        if (file) {
            this.validateMimeType(file.mimetype);
        }

        const sourceType = file
            ? (file.mimetype.startsWith('image/') ? 'IMAGE' : (ExtractionService.MIME_TO_SOURCE[file.mimetype] ?? 'UNKNOWN'))
            : 'TEXT';

        // Step 1 — Extract raw text from the file buffer, append pasted text
        const extractedFileText = file ? await this.extractText(file) : '';
        const rawText = [extractedFileText, textPayload].filter(Boolean).join('\n\n--- PASTED TEXT ---\n\n');

        // Step 2 — Mask PII before sending to any external service
        const maskedText = rawText ? this.complianceService.mask(rawText) : '';
        const piiDetected = maskedText !== rawText;

        if (piiDetected) {
            this.logger.warn(`PII detected and masked in request.`);
        }

        const isImage = file?.mimetype.startsWith('image/');
        let bufferToPass = isImage ? file?.buffer : undefined;
        let mimeTypeToPass = file?.mimetype ?? 'text/plain';

        // A PDF with no usable text (no text layer, and nothing pasted alongside it)
        // is almost always a scanned/image-only document. Rather than failing, render
        // its first page to an image and route it through the same vision path used
        // for direct image uploads.
        if (file?.mimetype === 'application/pdf' && !rawText.trim()) {
            try {
                bufferToPass = await this.renderPdfPageToImage(file);
                mimeTypeToPass = 'image/png';
                this.logger.log('PDF has no text layer — rendered page 1 to an image for vision extraction.');
            } catch (error) {
                this.logger.error('Failed to rasterize PDF for fallback extraction', error);
                throw new HttpException(
                    'This PDF has no extractable text layer and could not be rendered as an image either. Try uploading it as an image (PNG/JPEG) directly, or paste the invoice text manually.',
                    HttpStatus.UNPROCESSABLE_ENTITY,
                );
            }
        }

        let extractedInvoice: Invoice;
        let confidence: InvoiceConfidence;
        try {
            const groqResult = await this.callGroq(maskedText, mimeTypeToPass, bufferToPass);
            extractedInvoice = groqResult.invoice;
            confidence = groqResult.confidence;
        } catch (error) {
            const processingTimeMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            await this.prisma.extractionLog.create({
                data: {
                    sourceType,
                    originalFileName: file?.originalname ?? null,
                    fileSizeBytes: file?.size ?? null,
                    piiDetected,
                    processingTimeMs,
                    success: false,
                    errorMessage,
                },
            });

            this.logger.error('Failed to extract data via Groq API', error);
            if (error instanceof Error && error.message.includes('429')) {
                throw new HttpException('Rate limit exceeded. Please try again in a moment.', HttpStatus.TOO_MANY_REQUESTS);
            }
            throw new HttpException('Failed to process file through AI extraction engine.', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        const processingTimeMs = Date.now() - startTime;
        const confidenceValues = Object.values(confidence).filter((v) => typeof v === 'number') as number[];
        const avgConfidence = confidenceValues.length
            ? Math.round((confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length) * 100) / 100
            : 0;

        const log = await this.prisma.extractionLog.create({
            data: {
                sourceType,
                originalFileName: file?.originalname ?? null,
                fileSizeBytes: file?.size ?? null,
                piiDetected,
                processingTimeMs,
                avgConfidence,
                success: true,
            },
        });

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
            extractedInvoice,
            confidence,
            avgConfidence,
            processedAt: new Date().toISOString(),
            processingTimeMs,
            sourceType,
            logId: log.id,
        };

        this.logger.log(`Extraction complete in ${processingTimeMs}ms.`);
        return result;
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    /**
     * Decodes the file buffer to a UTF-8 string for plain-text formats,
     * pulls the text layer out of a PDF via pdf-parse, or defers to the
     * vision model for images (returns '' so the raw buffer is sent instead).
     */
    private async extractText(file: Express.Multer.File): Promise<string> {
        const textMimes = new Set(['text/plain', 'text/csv', 'application/json']);

        if (textMimes.has(file.mimetype)) {
            return file.buffer.toString('utf-8');
        }

        if (file.mimetype === 'application/pdf') {
            const parser = new PDFParse({ data: file.buffer });
            try {
                // pdf-parse's default pageJoiner inserts a "-- N of M --" marker between
                // pages even when a page has no real text — disabling it here so an
                // empty/scanned PDF actually trims down to an empty string, not boilerplate.
                const result = await parser.getText({ pageJoiner: '' });
                return result.text ?? '';
            } catch (error) {
                this.logger.error('Failed to parse PDF text layer', error);
                return '';
            } finally {
                await parser.destroy();
            }
        }

        this.logger.debug(
            `Handling binary MIME type (${file.mimetype}). Text extraction skipped or deferred to vision model.`,
        );
        return '';
    }

    /**
     * Renders the first page of a PDF to a PNG image via pdf-parse's bundled
     * rasterizer — used as a fallback for scanned/image-only PDFs that have
     * no extractable text layer, so they can go through the vision path
     * instead of failing outright.
     */
    private async renderPdfPageToImage(file: Express.Multer.File): Promise<Buffer> {
        const parser = new PDFParse({ data: file.buffer });
        try {
            const result = await parser.getScreenshot({ partial: [1], scale: 2 });
            const page = result.pages[0];
            if (!page?.data) {
                throw new Error('PDF rasterization produced no image data');
            }
            return Buffer.from(page.data);
        } finally {
            await parser.destroy();
        }
    }

    /**
     * Sends the sanitised text and/or image buffer to Groq and extracts invoice data
     * alongside a per-field confidence score (0–1).
     */
    private async callGroq(
        sanitisedText: string,
        mimeType: string,
        buffer?: Buffer,
    ): Promise<{ invoice: Invoice; confidence: InvoiceConfidence }> {
        const messages: any[] = [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `You are an invoice processing assistant. Extract the invoice data from the document.

Return ONLY a valid JSON object with exactly this structure — no other text:
{
  "invoice": {
    "invoiceNumber": "string or null",
    "issueDate": "string or null",
    "dueDate": "string or null",
    "vendorName": "string or null",
    "vendorAddress": "string or null",
    "customerName": "string or null",
    "customerAddress": "string or null",
    "lineItems": [{ "description": "string", "quantity": number, "unitPrice": number, "totalPrice": number }],
    "subtotal": number or null,
    "taxAmount": number or null,
    "totalAmount": number or null,
    "currency": "string or null"
  },
  "confidence": {
    "invoiceNumber": 0.0,
    "issueDate": 0.0,
    "dueDate": 0.0,
    "vendorName": 0.0,
    "vendorAddress": 0.0,
    "customerName": 0.0,
    "customerAddress": 0.0,
    "subtotal": 0.0,
    "taxAmount": 0.0,
    "totalAmount": 0.0,
    "currency": 0.0,
    "lineItems": 0.0
  }
}

CONFIDENCE SCORING — use ONLY these six exact values, nothing in between:

1.0 — The exact value is explicitly printed/written in the document. You read it directly with no interpretation needed.
0.8 — The value is present but required minor interpretation: e.g. handwriting, abbreviation, non-standard date format, or reconstructing a total from line items.
0.6 — The value is partially visible or you inferred it from strong surrounding context (e.g. "Net 30" implies a due date, a logo implies a vendor name).
0.4 — The value is not clearly stated. You estimated it from weak indirect evidence and another reader might reach a different answer.
0.2 — You guessed. The document gives almost no reliable signal for this field.
0.0 — The field value is null (not found), OR you have no defensible basis for the extracted value.

IMPORTANT RULES:
- You MUST use only: 0.0, 0.2, 0.4, 0.6, 0.8, or 1.0. No other values.
- If a field is null, its confidence MUST be 0.0.
- Fields that are commonly absent from invoices (dueDate, taxAmount, customerAddress) should realistically score lower when the document does not make them explicit.
- Be honest. A document that is scanned, handwritten, or photographed at an angle should produce lower scores than a clean digital PDF.`
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
            let jsonText = text.trim();
            if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
            }
            const parsed = JSON.parse(jsonText);
            return {
                invoice: parsed.invoice as Invoice,
                confidence: parsed.confidence as InvoiceConfidence,
            };
        } catch (error) {
            this.logger.error('Failed to parse AI response as JSON:', text);
            throw new HttpException('Failed to parse AI response', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getStats() {
        const [total, successCount, piiCount, bySourceType, avgTime, recent] = await Promise.all([
            this.prisma.extractionLog.count(),
            this.prisma.extractionLog.count({ where: { success: true } }),
            this.prisma.extractionLog.count({ where: { piiDetected: true } }),
            this.prisma.extractionLog.groupBy({
                by: ['sourceType'],
                _count: { id: true },
                _avg: { processingTimeMs: true },
            }),
            this.prisma.extractionLog.aggregate({
                _avg: { processingTimeMs: true },
                where: { success: true },
            }),
            this.prisma.extractionLog.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    sourceType: true,
                    originalFileName: true,
                    fileSizeBytes: true,
                    piiDetected: true,
                    processingTimeMs: true,
                    success: true,
                    errorMessage: true,
                    createdAt: true,
                },
            }),
        ]);

        return {
            total,
            successCount,
            failureCount: total - successCount,
            successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
            piiDetectedCount: piiCount,
            piiDetectionRate: total > 0 ? Math.round((piiCount / total) * 100) : 0,
            avgProcessingTimeMs: Math.round(avgTime._avg.processingTimeMs ?? 0),
            bySourceType: bySourceType.map((row) => ({
                sourceType: row.sourceType,
                count: row._count.id,
                avgProcessingTimeMs: Math.round(row._avg.processingTimeMs ?? 0),
            })),
            recentExtractions: recent,
        };
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
