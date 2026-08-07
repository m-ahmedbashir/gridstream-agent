import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';

export interface OcrResult {
    text: string;
    /** Tesseract's own confidence for this recognition pass, 0–100. */
    confidence: number;
}

/**
 * Runs OCR locally, on the server, so image content can be converted to text
 * — and therefore masked by ComplianceService — before anything is sent to
 * an external model. This is the actual fix for "PII masking doesn't cover
 * image content"; everything else in this pipeline was already text-safe.
 */
@Injectable()
export class OcrService {
    private readonly logger = new Logger(OcrService.name);

    async recognizeText(imageBuffer: Buffer): Promise<OcrResult> {
        const worker = await createWorker('eng');
        try {
            const { data } = await worker.recognize(imageBuffer);
            this.logger.log(`OCR complete: ${data.text.length} chars extracted, confidence ${data.confidence}.`);
            return { text: data.text ?? '', confidence: data.confidence ?? 0 };
        } finally {
            await worker.terminate();
        }
    }
}
