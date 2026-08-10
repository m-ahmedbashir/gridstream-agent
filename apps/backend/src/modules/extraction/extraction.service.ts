import { Injectable, Logger, Optional, UnsupportedMediaTypeException, HttpException, HttpStatus } from '@nestjs/common';
import { generateObject } from 'ai';
import { z } from 'zod';
import { PDFParse } from 'pdf-parse';
import { ComplianceService } from '../compliance/compliance.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Invoice, InvoiceConfidence, Receipt, ReceiptConfidence, Resume, ResumeConfidence } from '@opp/shared';
import {
    DEFAULT_MODEL_KEY,
    DEFAULT_PROCESSING_MODE,
    MODEL_REGISTRY,
    isProcessingMode,
    resolveModel,
    type ModelKey,
    type ProcessingMode,
} from './model-registry';
import {
    DEFAULT_DOCUMENT_TYPE,
    DOCUMENT_TYPE_KEYS,
    getDocumentTypeDescriptor,
    isDocumentTypeKey,
    type DocumentTypeKey,
} from './document-type-registry';
import { OcrService } from './ocr.service';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProcessedFile {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
}

export type ExtractedData = Invoice | Receipt | Resume;
export type ExtractedConfidence = InvoiceConfidence | ReceiptConfidence | ResumeConfidence;

export interface ExtractionResult {
    /** Original file info (omitted if only text was pasted) */
    file?: ProcessedFile;
    maskedText: string;
    piiDetected: boolean;
    /** True when the model reports seeing raw PII (email/phone/IBAN/card) printed in an image — text masking can't reach pixels. */
    imagePiiDetected: boolean;
    /** True when an image/scanned PDF page was read via local OCR instead of a vision model — see model-registry.ts's ProcessingMode. */
    ocrUsed: boolean;
    /** Which registry entry (document-type-registry.ts) was used — either the caller's override or the auto-classified type. */
    documentType: DocumentTypeKey;
    extractedData: ExtractedData;
    confidence: ExtractedConfidence;
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
 *   3. Send the sanitised content to the configured model provider with a structured extraction prompt.
 *   4. Return a typed ExtractionResult.
 */
@Injectable()
export class ExtractionService {
    private readonly logger = new Logger(ExtractionService.name);

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
        /**
         * Which registry entry to extract with. Fixed per-instance for now —
         * Phase 2 (see roadmap/phase2.md) will resolve this per-user instead.
         * @Optional() so Nest's DI doesn't try to resolve a provider for a
         * plain string-literal type and instead lets the default value apply.
         */
        @Optional() private readonly modelKey: ModelKey = DEFAULT_MODEL_KEY,
        /** A real, DI-registered provider — Nest resolves this normally, no @Optional() needed. */
        private readonly ocrService?: OcrService,
        /** Same @Optional() reasoning as modelKey — a plain string-literal type. */
        @Optional() private readonly processingMode: ProcessingMode = DEFAULT_PROCESSING_MODE,
    ) { }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Main entry point called by ExtractionController.
     *
     * @param file - Multer file object from the multipart upload.
     * @param textPayload - Pasted text, alongside or instead of a file.
     * @param requestedModelKey - Per-request model override (e.g. the calling
     *   user's saved preference). Falls back to this instance's configured
     *   default when omitted or when it isn't a recognised registry key.
     * @param apiKeyOverride - The calling user's own provider API key (BYOK),
     *   already decrypted by the caller. Never logged: this method scrubs it
     *   out of any downstream error message before it's stored or thrown.
     * @param requestedProcessingMode - Per-request override of how images/scanned
     *   PDFs get read ('vision' or 'local-ocr'). Falls back to this instance's
     *   configured default when omitted or unrecognised.
     * @param requestedDocumentType - Per-request override of which document-type
     *   registry entry to extract with (see document-type-registry.ts). Omitted
     *   or 'auto' triggers classification against the model instead.
     * @returns A fully structured ExtractionResult.
     */
    async processFile(
        file?: Express.Multer.File,
        textPayload?: string,
        requestedModelKey?: string,
        apiKeyOverride?: string,
        requestedProcessingMode?: string,
        requestedDocumentType?: string,
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

        const processingMode: ProcessingMode = isProcessingMode(requestedProcessingMode)
            ? requestedProcessingMode
            : this.processingMode;

        // Step 1 — Gather every text source (typed/pasted text, a PDF's text layer,
        // and — in local-ocr mode — OCR of any image content) BEFORE masking, so
        // nothing that later becomes text skips the PII pipeline.
        let extractedFileText = file ? await this.extractText(file) : '';
        const isImage = file?.mimetype.startsWith('image/');
        let ocrUsed = false;
        const ocrConfidences: number[] = [];

        if (isImage && file && processingMode === 'local-ocr' && this.ocrService) {
            const ocrResult = await this.ocrService.recognizeText(file.buffer);
            extractedFileText = ocrResult.text;
            ocrUsed = true;
            ocrConfidences.push(ocrResult.confidence);
            this.logger.log(`Local OCR mode: extracted ${ocrResult.text.length} chars from the image (Tesseract confidence ${ocrResult.confidence}).`);
        }

        let rawText = [extractedFileText, textPayload].filter(Boolean).join('\n\n--- PASTED TEXT ---\n\n');

        const isVisionMode = processingMode === 'vision' || (processingMode === 'local-ocr' && !this.ocrService);
        let buffersToPass = isImage && file && isVisionMode ? [file.buffer] : undefined;
        let mimeTypeToPass = file?.mimetype ?? 'text/plain';

        // A PDF with no usable text (no text layer, and nothing pasted alongside it)
        // is almost always a scanned/image-only document. In vision mode, render its
        // pages to images and route them through the vision path. In local-ocr mode,
        // render the same pages and OCR them instead — still text-only from here on,
        // never an image sent to the model. Capped at MAX_RASTERIZED_PDF_PAGES so a
        // huge document doesn't balloon into dozens of images/OCR passes in one request.
        if (file?.mimetype === 'application/pdf' && !rawText.trim()) {
            try {
                const pageImages = await this.renderPdfPagesToImages(file);
                if (processingMode === 'local-ocr' && this.ocrService) {
                    const pageTexts: string[] = [];
                    for (const pageImage of pageImages) {
                        const ocrResult = await this.ocrService.recognizeText(pageImage);
                        pageTexts.push(ocrResult.text);
                        ocrConfidences.push(ocrResult.confidence);
                    }
                    const ocrText = pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
                    rawText = [rawText, ocrText].filter(Boolean).join('\n\n--- PASTED TEXT ---\n\n');
                    ocrUsed = true;
                    this.logger.log(`Local OCR mode: rendered ${pageImages.length} page(s) and extracted text via Tesseract.`);
                } else {
                    buffersToPass = pageImages;
                    mimeTypeToPass = 'image/png';
                    this.logger.log(
                        `PDF has no text layer — rendered ${buffersToPass.length} page(s) to images for vision extraction.`,
                    );
                }
            } catch (error) {
                this.logger.error('Failed to rasterize PDF for fallback extraction', error);
                throw new HttpException(
                    'This PDF has no extractable text layer and could not be rendered as an image either. Try uploading it as an image (PNG/JPEG) directly, or paste the invoice text manually.',
                    HttpStatus.UNPROCESSABLE_ENTITY,
                );
            }
        }

        // Step 2 — Mask PII before sending to any external service. Runs once, after
        // every text source (including any OCR output above) has been gathered.
        const maskedText = rawText ? this.complianceService.mask(rawText) : '';
        const piiDetected = maskedText !== rawText;

        if (piiDetected) {
            this.logger.warn(`PII detected and masked in request.`);
        }

        // An unrecognised override (e.g. a stale saved preference for a model
        // that's since been removed from the registry) silently falls back to
        // this instance's default rather than throwing — the request still succeeds.
        const modelKey: ModelKey = requestedModelKey && requestedModelKey in MODEL_REGISTRY
            ? (requestedModelKey as ModelKey)
            : this.modelKey;

        // Fail loudly, not silently: a text-only model asked to read an image
        // would otherwise just get an image block it can't use. Never triggers in
        // local-ocr mode — buffersToPass is only ever populated in vision mode.
        const modelDescriptor = MODEL_REGISTRY[modelKey];
        if ((buffersToPass?.length ?? 0) > 0 && !modelDescriptor.supportsVision) {
            throw new HttpException(
                `The configured model (${modelDescriptor.modelId}) doesn't support image input, but this request requires reading an image or a rasterized PDF page. Choose a vision-capable model, or provide the invoice as text instead.`,
                HttpStatus.UNPROCESSABLE_ENTITY,
            );
        }

        // Step 3 — Resolve which document-type registry entry to extract with.
        // An explicit, recognised override skips classification entirely; otherwise
        // classify against the same (already-masked) text/images gathered above —
        // no second file read, no re-running PII masking.
        let documentType: DocumentTypeKey;
        if (isDocumentTypeKey(requestedDocumentType)) {
            documentType = requestedDocumentType;
        } else {
            try {
                documentType = await this.classifyDocumentType(maskedText, mimeTypeToPass, buffersToPass, modelKey, apiKeyOverride);
            } catch (error) {
                this.logger.warn(`Document-type classification failed, defaulting to '${DEFAULT_DOCUMENT_TYPE}': ${error instanceof Error ? error.message : 'Unknown error'}`);
                documentType = DEFAULT_DOCUMENT_TYPE;
            }
        }

        let extractedData: ExtractedData;
        let confidence: ExtractedConfidence;
        let imagePiiDetected = false;
        try {
            const modelResult = await this.callModel(maskedText, mimeTypeToPass, buffersToPass, modelKey, documentType, apiKeyOverride);
            extractedData = modelResult.data;
            // OCR can introduce reading errors the downstream model has no way to know
            // about — it only sees the (possibly already-wrong) text. Cap confidence
            // accordingly rather than letting a garbled OCR pass produce a false "1.0,
            // read directly, no interpretation needed."
            confidence = this.capConfidenceForOcr(modelResult.confidence, ocrConfidences);
            imagePiiDetected = modelResult.imagePiiDetected;
        } catch (error) {
            const processingTimeMs = Date.now() - startTime;
            const rawErrorMessage = error instanceof Error ? error.message : 'Unknown error';
            // Defense in depth: a provider error should never echo an API key back, but
            // scrub it out of anything we log or persist in case one ever does.
            const errorMessage = apiKeyOverride
                ? rawErrorMessage.split(apiKeyOverride).join('[REDACTED:API_KEY]')
                : rawErrorMessage;

            await this.prisma.extractionLog.create({
                data: {
                    sourceType,
                    documentType,
                    originalFileName: file?.originalname ?? null,
                    fileSizeBytes: file?.size ?? null,
                    piiDetected,
                    ocrUsed,
                    processingTimeMs,
                    success: false,
                    errorMessage,
                },
            });

            // Log the scrubbed message, not the raw error object — an SDK error can carry
            // request details in properties Logger.error() would otherwise print in full.
            this.logger.error(`Failed to extract data via the AI provider: ${errorMessage}`);
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
                documentType,
                originalFileName: file?.originalname ?? null,
                fileSizeBytes: file?.size ?? null,
                piiDetected,
                imagePiiDetected,
                ocrUsed,
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
            imagePiiDetected,
            ocrUsed,
            documentType,
            extractedData,
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
     * Caps per-field confidence when the source text came from OCR rather than
     * being typed, pasted, or read from a PDF's real text layer. The model that
     * scores confidence only ever sees the (possibly already-wrong) OCR output —
     * it has no way to know Tesseract might have misread a character — so a
     * blanket ceiling derived from Tesseract's *own* confidence is more honest
     * than trusting the model's "1.0, read directly" at face value.
     *
     * Ceiling bands (deliberately coarse, matching the six-anchor scale):
     *   Tesseract confidence ≥ 80  → cap at 0.8 (minor interpretation, at best)
     *   Tesseract confidence ≥ 50  → cap at 0.6 (partially reliable)
     *   otherwise                 → cap at 0.4 (weak signal)
     */
    private capConfidenceForOcr<C extends ExtractedConfidence>(confidence: C, ocrConfidences: number[]): C {
        if (ocrConfidences.length === 0) {
            return confidence;
        }

        const avgOcrConfidence = ocrConfidences.reduce((a, b) => a + b, 0) / ocrConfidences.length;
        const ceiling = avgOcrConfidence >= 80 ? 0.8 : avgOcrConfidence >= 50 ? 0.6 : 0.4;

        const capped = {} as Record<string, number>;
        for (const [field, value] of Object.entries(confidence)) {
            capped[field] = typeof value === 'number' ? Math.min(value, ceiling) : value;
        }
        return capped as unknown as C;
    }

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

    /** Cap on how many rasterized PDF pages get sent to the model in one request. */
    private static readonly MAX_RASTERIZED_PDF_PAGES = 5;

    /**
     * Renders the first N pages of a PDF to PNG images via pdf-parse's bundled
     * rasterizer — used as a fallback for scanned/image-only PDFs that have no
     * extractable text layer, so they can go through the vision path instead
     * of failing outright. Capped so a huge document doesn't balloon into
     * dozens of images in a single request.
     */
    private async renderPdfPagesToImages(file: Express.Multer.File): Promise<Buffer[]> {
        const parser = new PDFParse({ data: file.buffer });
        try {
            const result = await parser.getScreenshot({
                first: ExtractionService.MAX_RASTERIZED_PDF_PAGES,
                scale: 2,
            });
            const buffers: Buffer[] = [];
            for (const page of result.pages) {
                if (page?.data) {
                    buffers.push(Buffer.from(page.data));
                }
            }
            if (buffers.length === 0) {
                throw new Error('PDF rasterization produced no image data');
            }
            return buffers;
        } finally {
            await parser.destroy();
        }
    }

    /**
     * Builds the `content` array of a single user message: a lead-in prompt,
     * the sanitised document text (if any), and every image buffer (if any).
     * Shared by both `classifyDocumentType()` and `callModel()` so the two
     * model calls always see identical document content.
     */
    private buildContentBlocks(promptText: string, sanitisedText: string, mimeType: string, buffers: Buffer[] | undefined): any[] {
        const content: any[] = [{ type: 'text', text: promptText }];

        if (sanitisedText) {
            content.push({ type: 'text', text: `\n\nDocument text:\n${sanitisedText}` });
        }

        for (const buffer of buffers ?? []) {
            content.push({ type: 'image', image: buffer, mimeType });
        }

        return content;
    }

    /**
     * Classifies which document-type registry entry (see document-type-registry.ts)
     * best matches the document, using a cheap `generateObject()` call against the
     * same sanitised text/images `callModel()` will use — no second file read.
     */
    private async classifyDocumentType(
        sanitisedText: string,
        mimeType: string,
        buffers: Buffer[] | undefined,
        modelKey: ModelKey,
        apiKeyOverride?: string,
    ): Promise<DocumentTypeKey> {
        const prompt = `Classify this document into exactly one of the following types: ${DOCUMENT_TYPE_KEYS.join(', ')}.
Base your answer only on the document content provided below.`;

        const { object } = await generateObject({
            model: resolveModel(modelKey, apiKeyOverride),
            schema: z.object({ documentType: z.enum(DOCUMENT_TYPE_KEYS as [DocumentTypeKey, ...DocumentTypeKey[]]) }),
            messages: [{ role: 'user', content: this.buildContentBlocks(prompt, sanitisedText, mimeType, buffers) }],
        });

        return object.documentType;
    }

    /**
     * Sends the sanitised text and/or image buffers to the configured model
     * (resolved via the model registry) and extracts data for the given
     * document type alongside a per-field confidence score (0–1) and an
     * image-PII flag.
     *
     * Uses `generateObject()` so the model's output is validated directly against
     * the resolved document-type's schema — no manual JSON.parse, no hand-written
     * catch for malformed responses. Schema validation failures propagate as-is
     * and are caught by the outer try/catch in `processFile()`.
     */
    private async callModel(
        sanitisedText: string,
        mimeType: string,
        buffers: Buffer[] | undefined,
        modelKey: ModelKey,
        documentType: DocumentTypeKey,
        apiKeyOverride?: string,
    ): Promise<{ data: ExtractedData; confidence: ExtractedConfidence; imagePiiDetected: boolean }> {
        const descriptor = getDocumentTypeDescriptor(documentType);

        // descriptor.schema is typed as the general z.ZodTypeAny (it varies per
        // registry entry), which widens generateObject's inferred `object` to
        // `unknown` — asserted back to the shape every buildResponseSchema()
        // entry actually produces.
        const { object } = (await generateObject({
            model: resolveModel(modelKey, apiKeyOverride),
            schema: descriptor.schema,
            messages: [{ role: 'user', content: this.buildContentBlocks(descriptor.prompt, sanitisedText, mimeType, buffers) }],
        })) as { object: { data: unknown; confidence: unknown; imagePiiDetected: boolean } };

        return {
            data: object.data as ExtractedData,
            confidence: object.confidence as ExtractedConfidence,
            // Force false when no image was actually sent — never trust the model's
            // claim about image content it was never given.
            imagePiiDetected: (buffers?.length ?? 0) > 0 && object.imagePiiDetected,
        };
    }

    /** Lists the registry so the frontend's model picker has a single source of truth, not a hand-duplicated copy. */
    getModels() {
        return Object.entries(MODEL_REGISTRY).map(([key, descriptor]) => ({ key, ...descriptor }));
    }

    /** Lists the document-type registry so the frontend's type picker never hand-duplicates it. */
    getDocumentTypes() {
        return DOCUMENT_TYPE_KEYS.map((key) => ({ key, label: getDocumentTypeDescriptor(key).label }));
    }

    async getStats() {
        const [total, successCount, piiCount, imagePiiCount, ocrCount, bySourceType, avgTime, recent] = await Promise.all([
            this.prisma.extractionLog.count(),
            this.prisma.extractionLog.count({ where: { success: true } }),
            this.prisma.extractionLog.count({ where: { piiDetected: true } }),
            this.prisma.extractionLog.count({ where: { imagePiiDetected: true } }),
            this.prisma.extractionLog.count({ where: { ocrUsed: true } }),
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
                    imagePiiDetected: true,
                    ocrUsed: true,
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
            imagePiiDetectedCount: imagePiiCount,
            imagePiiDetectionRate: total > 0 ? Math.round((imagePiiCount / total) * 100) : 0,
            ocrUsedCount: ocrCount,
            ocrUsageRate: total > 0 ? Math.round((ocrCount / total) * 100) : 0,
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
