import { ExtractionService, ExtractionResult } from './extraction.service';
import { ComplianceService } from '../compliance/compliance.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock the entire ai and @ai-sdk/google modules so tests never touch the network
jest.mock('ai', () => ({
    generateObject: jest.fn().mockResolvedValue({
        object: {
            invoiceNumber: 'INV-001',
            totalAmount: 1500,
            currency: 'EUR',
        },
    }),
}));

jest.mock('@ai-sdk/google', () => ({
    google: jest.fn().mockReturnValue('mock-model'),
}));

import { generateObject } from 'ai';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFile(
    content: string,
    mimeType = 'text/plain',
    name = 'invoice.txt',
): Express.Multer.File {
    const buffer = Buffer.from(content, 'utf-8');
    return {
        fieldname: 'file',
        originalname: name,
        encoding: '7bit',
        mimetype: mimeType,
        buffer,
        size: buffer.length,
        stream: null as any,
        destination: '',
        filename: name,
        path: '',
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ExtractionService', () => {
    let service: ExtractionService;
    let complianceService: ComplianceService;

    beforeEach(() => {
        complianceService = new ComplianceService();
        service = new ExtractionService(complianceService);
        jest.clearAllMocks();
    });

    describe('processFile()', () => {
        it('should return an ExtractionResult with the expected shape', async () => {
            const file = makeFile('Invoice total: 1500 EUR', 'text/plain');

            const result: ExtractionResult = await service.processFile(file);

            expect(result).toMatchObject({
                file: {
                    originalName: 'invoice.txt',
                    mimeType: 'text/plain',
                },
                piiDetected: false,
            });
            expect(typeof result.maskedText).toBe('string');
            expect(typeof result.geminiResponse).toBe('object');
            expect(result.geminiResponse.invoiceNumber).toBe('INV-001');
            expect(typeof result.processedAt).toBe('string');
        });

        it('should call ComplianceService.mask() before calling Gemini', async () => {
            const maskSpy = jest.spyOn(complianceService, 'mask');
            const file = makeFile('Contact finance@corp.com', 'text/plain');

            await service.processFile(file);

            expect(maskSpy).toHaveBeenCalledTimes(1);
            expect(maskSpy).toHaveBeenCalledWith('Contact finance@corp.com');
        });

        it('should flag piiDetected=true when the file contains an email', async () => {
            const file = makeFile('Invoice from user@example.com', 'text/plain');

            const result = await service.processFile(file);

            expect(result.piiDetected).toBe(true);
            expect(result.maskedText).not.toContain('user@example.com');
            expect(result.maskedText).toContain('[REDACTED:EMAIL]');
        });

        it('should call generateObject (Gemini) exactly once per file', async () => {
            const file = makeFile('Total: 500 USD', 'text/plain');

            await service.processFile(file);

            expect(generateObject).toHaveBeenCalledTimes(1);
        });

        it('should throw UnsupportedMediaTypeException for disallowed MIME types', async () => {
            const file = makeFile('data', 'application/zip', 'archive.zip');

            await expect(service.processFile(file)).rejects.toThrow(
                'Unsupported file type',
            );
        });

        it('should handle CSV files as plain text', async () => {
            const csvContent = 'date,amount,vendor\n2024-01-01,500.00,ACME Corp';
            const file = makeFile(csvContent, 'text/csv', 'report.csv');

            const result = await service.processFile(file);

            expect(result.file.mimeType).toBe('text/csv');
            expect(result.maskedText).toContain('ACME Corp');
        });
    });
});
