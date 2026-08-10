import { Injectable, Logger, Optional, UnsupportedMediaTypeException, HttpException, HttpStatus } from '@nestjs/common';
import { generateText, APICallError } from 'ai';
import { PDFParse } from 'pdf-parse';
import { ComplianceService } from '../compliance/compliance.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
    MachineProfileSchema,
    MachineProfileConfidenceSchema,
    buildResponseSchema,
    MachineType,
    Criticality,
    type MachineProfile,
    type MachineProfileConfidence,
} from '@maintain/shared';
import {
    DEFAULT_MODEL_KEY,
    DEFAULT_PROCESSING_MODE,
    MODEL_REGISTRY,
    isProcessingMode,
    resolveModel,
    type ModelKey,
    type ProcessingMode,
} from '../extraction/model-registry';
import { OcrService } from '../extraction/ocr.service';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProcessedFile {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
}

export interface MaintenanceExtractionResult {
    file?: ProcessedFile;
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

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * MaintenanceExtractionService
 *
 * Reuses the existing extraction pipeline patterns to extract structured
 * machine-profile data from German industrial maintenance reports.
 */
@Injectable()
export class MaintenanceExtractionService {
    private readonly logger = new Logger(MaintenanceExtractionService.name);

    private static readonly MIME_TO_SOURCE: Record<string, string> = {
        'text/plain': 'TEXT',
        'text/csv': 'CSV',
        'application/json': 'JSON',
        'application/pdf': 'PDF',
    };

    private static readonly SUPPORTED_MIME_TYPES = new Set([
        'text/plain',
        'text/csv',
        'application/json',
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
    ]);

    private static readonly RESPONSE_SCHEMA = buildResponseSchema(
        MachineProfileSchema,
        MachineProfileConfidenceSchema,
    );

    private static readonly EXTRACTION_PROMPT = `You are a German industrial maintenance report parser. Extract the machine profile from the maintenance report and populate every field you can find.

Fields:
- machineId: the machine identifier (e.g., serial number or asset tag)
- machineType: one of CNC, HVAC, Compressor, Pump, Conveyor, Other
- manufacturer: the machine manufacturer/vendor
- yearInstalled: year the machine was installed (1900–2030)
- runtimeHours: total operating hours as an integer
- lastServiceDate: FULL ISO-8601 datetime with time and "Z", e.g. "2024-03-15T00:00:00Z" — never a bare date like "2024-03-15" — or null if not found
- observedIssues: array of observed issues from the report
- energyConsumptionKwh: energy consumption per hour in kWh, or null
- criticality: one of low, medium, high, critical
- location: physical plant location, or null

- machineId, machineType, manufacturer, yearInstalled, runtimeHours, and criticality are REQUIRED and must NEVER be null — the schema rejects null for these. If you cannot find one, give your single best guess (e.g. "Other" for machineType, "Unknown" for manufacturer/machineId, a plausible year/hour count) and score its confidence 0.2 (or 0.0 only if you truly have zero basis, but the field itself must still hold a value).
- lastServiceDate, energyConsumptionKwh, and location ARE nullable — set them to null if not found, with confidence 0.0.
- observedIssues is an array — use an empty array [] if none are found, with confidence 0.0.
- Every confidence value must be a raw JSON number (e.g. 0.8), never a quoted string (e.g. NOT "0.8").

CONFIDENCE SCORING — use ONLY these six exact values for every confidence field, nothing in between:

1.0 — The exact value is explicitly printed/written in the document. You read it directly with no interpretation needed.
0.8 — The value is present but required minor interpretation: e.g. handwriting, abbreviation, non-standard date format.
0.6 — The value is partially visible or you inferred it from strong surrounding context.
0.4 — The value is not clearly stated. You estimated it from weak indirect evidence.
0.2 — You guessed. The document gives almost no reliable signal for this field.
0.0 — The field value is null (not found), OR you have no defensible basis for the extracted value.

IMPORTANT RULES:
- You MUST use only: 0.0, 0.2, 0.4, 0.6, 0.8, or 1.0. No other values.
- If a field is null (or an empty array), its confidence MUST be 0.0.
- Be honest. A document that is scanned, handwritten, or photographed at an angle should produce lower scores than a clean digital original.

IMAGE PII CHECK — only relevant when one or more images were provided:
- Set imagePiiDetected to true if the image(s) visibly show a personal email address, phone number, IBAN/bank account number, or credit/debit card number ANYWHERE in the frame.
- If no image was provided at all, set imagePiiDetected to false.`;

    constructor(
        private readonly complianceService: ComplianceService,
        private readonly prisma: PrismaService,
        @Optional() private readonly modelKey: ModelKey = DEFAULT_MODEL_KEY,
        private readonly ocrService?: OcrService,
        @Optional() private readonly processingMode: ProcessingMode = DEFAULT_PROCESSING_MODE,
    ) { }

    // ── Public API ─────────────────────────────────────────────────────────────

    async processFile(
        userId: string,
        file?: Express.Multer.File,
        textPayload?: string,
        requestedModelKey?: string,
        apiKeyOverride?: string,
        requestedProcessingMode?: string,
    ): Promise<MaintenanceExtractionResult> {
        const startTime = Date.now();

        this.logger.log(
            `Processing maintenance report: file=${file?.originalname ?? 'none'}, text=${textPayload ? 'provided' : 'none'}`
        );

        if (!file && !textPayload) {
            throw new HttpException('Must provide either a file or a text payload', HttpStatus.BAD_REQUEST);
        }

        if (file) {
            this.validateMimeType(file.mimetype);
        }

        const sourceType = file
            ? (file.mimetype.startsWith('image/') ? 'IMAGE' : (MaintenanceExtractionService.MIME_TO_SOURCE[file.mimetype] ?? 'UNKNOWN'))
            : 'TEXT';

        const processingMode: ProcessingMode = isProcessingMode(requestedProcessingMode)
            ? requestedProcessingMode
            : this.processingMode;

        let extractedFileText = file ? await this.extractText(file) : '';
        const isImage = file?.mimetype.startsWith('image/');
        let ocrUsed = false;
        const ocrConfidences: number[] = [];

        if (isImage && file && processingMode === 'local-ocr' && this.ocrService) {
            const ocrResult = await this.ocrService.recognizeText(file.buffer);
            extractedFileText = ocrResult.text;
            ocrUsed = true;
            ocrConfidences.push(ocrResult.confidence);
            this.logger.log(`Local OCR mode: extracted ${ocrResult.text.length} chars (Tesseract confidence ${ocrResult.confidence}).`);
        }

        let rawText = [extractedFileText, textPayload].filter(Boolean).join('\n\n--- PASTED TEXT ---\n\n');

        const isVisionMode = processingMode === 'vision' || (processingMode === 'local-ocr' && !this.ocrService);
        let buffersToPass = isImage && file && isVisionMode ? [file.buffer] : undefined;
        let mimeTypeToPass = file?.mimetype ?? 'text/plain';

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
                    this.logger.log(`PDF has no text layer — rendered ${pageImages.length} page(s) to images for vision extraction.`);
                }
            } catch (error) {
                this.logger.error('Failed to rasterize PDF for fallback extraction', error);
                throw new HttpException(
                    'This PDF has no extractable text layer and could not be rendered as an image either. Try uploading it as an image (PNG/JPEG) directly, or paste the maintenance report text manually.',
                    HttpStatus.UNPROCESSABLE_ENTITY,
                );
            }
        }

        const maskedText = rawText ? this.complianceService.mask(rawText) : '';
        const piiDetected = maskedText !== rawText;

        if (piiDetected) {
            this.logger.warn(`PII detected and masked in maintenance report request.`);
        }

        const modelKey: ModelKey = requestedModelKey && requestedModelKey in MODEL_REGISTRY
            ? (requestedModelKey as ModelKey)
            : this.modelKey;

        const modelDescriptor = MODEL_REGISTRY[modelKey];
        if ((buffersToPass?.length ?? 0) > 0 && !modelDescriptor.supportsVision) {
            throw new HttpException(
                `The configured model (${modelDescriptor.modelId}) doesn't support image input, but this request requires reading an image or a rasterized PDF page. Choose a vision-capable model, or provide the report as text instead.`,
                HttpStatus.UNPROCESSABLE_ENTITY,
            );
        }

        let extractedData: MachineProfile;
        let confidence: MachineProfileConfidence;
        let imagePiiDetected = false;
        try {
            const modelResult = await this.callModel(maskedText, mimeTypeToPass, buffersToPass, modelKey, apiKeyOverride);
            extractedData = modelResult.data as MachineProfile;
            confidence = this.capConfidenceForOcr(modelResult.confidence as MachineProfileConfidence, ocrConfidences);
            imagePiiDetected = modelResult.imagePiiDetected;
        } catch (error) {
            const processingTimeMs = Date.now() - startTime;
            const rawErrorMessage = error instanceof Error ? error.message : 'Unknown error';
            const redact = (message: string) =>
                apiKeyOverride ? message.split(apiKeyOverride).join('[REDACTED:API_KEY]') : message;
            const errorMessage = redact(rawErrorMessage);

            // APICallError.message is a generic "Invalid JSON response" — the useful
            // diagnostic (what the provider actually sent back, e.g. a rate-limit or
            // auth error body instead of a chat completion) lives in these fields.
            if (APICallError.isInstance(error)) {
                this.logger.error(
                    `AI provider call failed: status=${error.statusCode ?? 'unknown'} url=${error.url} responseBody=${redact(error.responseBody ?? '(empty)').slice(0, 2000)}`,
                );
            }

            await this.prisma.extractionLog.create({
                data: {
                    sourceType,
                    documentType: 'maintenance_report',
                    originalFileName: file?.originalname ?? null,
                    fileSizeBytes: file?.size ?? null,
                    piiDetected,
                    ocrUsed,
                    processingTimeMs,
                    success: false,
                    errorMessage,
                },
            });

            this.logger.error(`Failed to extract maintenance report via the AI provider: ${errorMessage}`);
            if (error instanceof Error && error.message.includes('429')) {
                throw new HttpException('Rate limit exceeded. Please try again in a moment.', HttpStatus.TOO_MANY_REQUESTS);
            }
            throw new HttpException('Failed to process maintenance report through AI extraction engine.', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        const processingTimeMs = Date.now() - startTime;
        const confidenceValues = Object.values(confidence).filter((v) => typeof v === 'number') as number[];
        const avgConfidence = confidenceValues.length
            ? Math.round((confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length) * 100) / 100
            : 0;

        const log = await this.prisma.extractionLog.create({
            data: {
                sourceType,
                documentType: 'maintenance_report',
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

        // Persist the machine profile for downstream matching/planning.
        const machineProfileId = await this.persistMachineProfile(userId, extractedData, maskedText);

        const result: MaintenanceExtractionResult = {
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
            extractedData,
            machineProfileId,
            confidence,
            avgConfidence,
            processedAt: new Date().toISOString(),
            processingTimeMs,
            sourceType,
            logId: log.id,
        };

        this.logger.log(`Maintenance extraction complete in ${processingTimeMs}ms.`);
        return result;
    }

    async getStats() {
        const [total, successCount, piiCount, imagePiiCount, ocrCount, visionCount, byMachineType, avgTime, recent] = await Promise.all([
            this.prisma.extractionLog.count({ where: { documentType: 'maintenance_report' } }),
            this.prisma.extractionLog.count({ where: { documentType: 'maintenance_report', success: true } }),
            this.prisma.extractionLog.count({ where: { documentType: 'maintenance_report', piiDetected: true } }),
            this.prisma.extractionLog.count({ where: { documentType: 'maintenance_report', imagePiiDetected: true } }),
            this.prisma.extractionLog.count({ where: { documentType: 'maintenance_report', ocrUsed: true } }),
            this.prisma.extractionLog.count({ where: { documentType: 'maintenance_report', ocrUsed: false } }),
            this.prisma.machineProfile.groupBy({
                by: ['machineType'],
                _count: { id: true },
            }),
            this.prisma.extractionLog.aggregate({
                _avg: { avgConfidence: true },
                where: { documentType: 'maintenance_report', success: true },
            }),
            this.prisma.extractionLog.findMany({
                where: { documentType: 'maintenance_report' },
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
            imagePiiDetectedCount: imagePiiCount,
            ocrUsedCount: ocrCount,
            ocrUsageRate: total > 0 ? Math.round((ocrCount / total) * 100) : 0,
            visionUsageRate: total > 0 ? Math.round((visionCount / total) * 100) : 0,
            avgConfidence: Math.round((avgTime._avg.avgConfidence ?? 0) * 100) / 100,
            topMachineTypes: byMachineType
                .map((row) => ({ machineType: row.machineType, count: row._count.id }))
                .sort((a, b) => b.count - a.count),
            recentExtractions: recent,
        };
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private capConfidenceForOcr<C extends MachineProfileConfidence>(confidence: C, ocrConfidences: number[]): C {
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

    private async extractText(file: Express.Multer.File): Promise<string> {
        const textMimes = new Set(['text/plain', 'text/csv', 'application/json']);

        if (textMimes.has(file.mimetype)) {
            return file.buffer.toString('utf-8');
        }

        if (file.mimetype === 'application/pdf') {
            const parser = new PDFParse({ data: file.buffer });
            try {
                const result = await parser.getText({ pageJoiner: '' });
                return result.text ?? '';
            } catch (error) {
                this.logger.error('Failed to parse PDF text layer', error);
                return '';
            } finally {
                await parser.destroy();
            }
        }

        this.logger.debug(`Handling binary MIME type (${file.mimetype}). Text extraction skipped or deferred to vision model.`);
        return '';
    }

    private static readonly MAX_RASTERIZED_PDF_PAGES = 5;

    private async renderPdfPagesToImages(file: Express.Multer.File): Promise<Buffer[]> {
        const parser = new PDFParse({ data: file.buffer });
        try {
            const result = await parser.getScreenshot({
                first: MaintenanceExtractionService.MAX_RASTERIZED_PDF_PAGES,
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

    private async callModel(
        sanitisedText: string,
        mimeType: string,
        buffers: Buffer[] | undefined,
        modelKey: ModelKey,
        apiKeyOverride?: string,
    ): Promise<{ data: MachineProfile; confidence: MachineProfileConfidence; imagePiiDetected: boolean }> {
        const content: any[] = [
            { type: 'text', text: MaintenanceExtractionService.EXTRACTION_PROMPT },
            {
                type: 'text',
                text: '\n\nReturn ONLY a raw JSON object (no markdown fences, no explanations) with exactly these three TOP-LEVEL keys — "imagePiiDetected" is a sibling of "data" and "confidence", never nested inside "data":\n' +
                    '{ "data": { "machineId": ..., "machineType": ..., "manufacturer": ..., "yearInstalled": ..., "runtimeHours": ..., "lastServiceDate": ..., "observedIssues": [...], "energyConsumptionKwh": ..., "criticality": ..., "location": ... }, "confidence": { <one number 0.0-1.0 per field in data> }, "imagePiiDetected": <boolean> }',
            },
        ];

        if (sanitisedText) {
            content.push({ type: 'text', text: `\n\nDocument text:\n${sanitisedText}` });
        }

        for (const buffer of buffers ?? []) {
            content.push({ type: 'image', image: buffer, mimeType });
        }

        const { text } = await generateText({
            model: resolveModel(modelKey, apiKeyOverride),
            messages: [{ role: 'user', content }],
        });

        const cleaned = this.extractJson(text);
        const parsed = this.repairModelResponse(JSON.parse(cleaned));
        const validated = MaintenanceExtractionService.RESPONSE_SCHEMA.parse(parsed) as {
            data: MachineProfile;
            confidence: MachineProfileConfidence;
            imagePiiDetected: boolean;
        };

        return {
            data: validated.data,
            confidence: validated.confidence,
            imagePiiDetected: (buffers?.length ?? 0) > 0 && validated.imagePiiDetected,
        };
    }

    /**
     * Free/weak models occasionally deviate from the requested shape in a few
     * predictable ways. Repairing those here beats hard-failing the whole
     * extraction on an otherwise-usable response — the schema still rejects
     * anything genuinely malformed afterwards.
     */
    private repairModelResponse(parsed: unknown): unknown {
        if (typeof parsed !== 'object' || parsed === null) {
            return parsed;
        }
        const root = parsed as Record<string, any>;
        const data = root.data;
        if (typeof data !== 'object' || data === null) {
            return root;
        }

        // Some models nest imagePiiDetected inside `data` instead of at the top level.
        if (root.imagePiiDetected === undefined && 'imagePiiDetected' in data) {
            root.imagePiiDetected = data.imagePiiDetected;
            delete data.imagePiiDetected;
        }

        const confidence = typeof root.confidence === 'object' && root.confidence !== null ? root.confidence : undefined;

        // Weak models sometimes quote confidence numbers as strings (e.g. "0.8").
        if (confidence) {
            for (const key of Object.keys(confidence)) {
                if (typeof confidence[key] === 'string') {
                    const num = Number(confidence[key]);
                    confidence[key] = Number.isFinite(num) ? num : 0;
                }
            }
        }

        const downgrade = (field: string) => {
            if (confidence && typeof confidence[field] === 'number') {
                confidence[field] = 0.2;
            }
        };

        // lastServiceDate must be a strict ISO-8601 datetime with a time and "Z" —
        // models often give a bare date ("2024-03-15") or a localized date.
        if (typeof data.lastServiceDate === 'string') {
            const parsedDate = new Date(data.lastServiceDate);
            if (Number.isNaN(parsedDate.getTime())) {
                // Unparseable — null it out with zero confidence, per the "null implies 0.0" rule.
                data.lastServiceDate = null;
                if (confidence && typeof confidence.lastServiceDate === 'number') {
                    confidence.lastServiceDate = 0;
                }
            } else {
                data.lastServiceDate = parsedDate.toISOString();
            }
        }

        if (typeof data.yearInstalled === 'number' && (data.yearInstalled < 1900 || data.yearInstalled > 2030)) {
            data.yearInstalled = Math.min(2030, Math.max(1900, Math.round(data.yearInstalled)));
            downgrade('yearInstalled');
        }
        if (typeof data.runtimeHours === 'number' && data.runtimeHours < 0) {
            data.runtimeHours = 0;
            downgrade('runtimeHours');
        }
        if (typeof data.machineType === 'string' && !(MachineType.options as readonly string[]).includes(data.machineType)) {
            data.machineType = 'Other';
            downgrade('machineType');
        }
        if (typeof data.criticality === 'string' && !(Criticality.options as readonly string[]).includes(data.criticality)) {
            data.criticality = 'medium';
            downgrade('criticality');
        }

        return root;
    }

    private extractJson(text: string): string {
        // Strip markdown fences and any trailing explanation.
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenced) {
            return fenced[1].trim();
        }
        // Find the first { and last } to ignore surrounding text.
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) {
            throw new Error('No JSON object found in model response');
        }
        return text.slice(start, end + 1).trim();
    }

    private async persistMachineProfile(userId: string, data: MachineProfile, rawText: string) {
        await this.prisma.user.upsert({
            where: { clerkId: userId },
            create: { clerkId: userId },
            update: {},
        });

        const user = await this.prisma.user.findUnique({ where: { clerkId: userId } });
        if (!user) {
            throw new HttpException('User could not be resolved after upsert', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        const profile = await this.prisma.machineProfile.upsert({
            where: { machineId: data.machineId },
            create: {
                userId: user.id,
                machineId: data.machineId,
                machineType: data.machineType,
                manufacturer: data.manufacturer,
                yearInstalled: data.yearInstalled,
                runtimeHours: data.runtimeHours,
                lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : null,
                observedIssues: data.observedIssues,
                energyConsumptionKwh: data.energyConsumptionKwh ?? null,
                criticality: data.criticality,
                location: data.location ?? null,
                rawText,
            },
            update: {
                machineType: data.machineType,
                manufacturer: data.manufacturer,
                yearInstalled: data.yearInstalled,
                runtimeHours: data.runtimeHours,
                lastServiceDate: data.lastServiceDate ? new Date(data.lastServiceDate) : null,
                observedIssues: data.observedIssues,
                energyConsumptionKwh: data.energyConsumptionKwh ?? null,
                criticality: data.criticality,
                location: data.location ?? null,
                rawText,
                extractedAt: new Date(),
            },
        });

        return profile.id;
    }

    private validateMimeType(mimeType: string): void {
        if (!MaintenanceExtractionService.SUPPORTED_MIME_TYPES.has(mimeType)) {
            throw new UnsupportedMediaTypeException(
                `Unsupported file type: ${mimeType}. Accepted types: ${[...MaintenanceExtractionService.SUPPORTED_MIME_TYPES].join(', ')}`,
            );
        }
    }
}
