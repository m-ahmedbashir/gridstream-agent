import { ExtractionService, ExtractionResult } from './extraction.service';
import { ComplianceService } from '../compliance/compliance.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock the SDK boundary so tests never touch the network. The real service
// calls `generateText` from `ai`, using a model built by `createGroq` from
// `@ai-sdk/groq` — mock exactly those, not the earlier Gemini-era imports.
jest.mock('ai', () => ({
    generateText: jest.fn().mockResolvedValue({
        text: JSON.stringify({
            invoice: {
                invoiceNumber: 'INV-001',
                issueDate: '2024-01-01',
                dueDate: '2024-01-31',
                vendorName: 'ACME Corp',
                vendorAddress: null,
                customerName: null,
                customerAddress: null,
                lineItems: [],
                subtotal: 1500,
                taxAmount: 0,
                totalAmount: 1500,
                currency: 'EUR',
            },
            confidence: {
                invoiceNumber: 1.0,
                issueDate: 1.0,
                dueDate: 0.8,
                vendorName: 1.0,
                vendorAddress: 0.0,
                customerName: 0.0,
                customerAddress: 0.0,
                subtotal: 1.0,
                taxAmount: 0.6,
                totalAmount: 1.0,
                currency: 1.0,
                lineItems: 0.4,
            },
        }),
    }),
}));

jest.mock('@ai-sdk/groq', () => ({
    createGroq: jest.fn().mockReturnValue(jest.fn().mockReturnValue('mock-model')),
}));

// pdf-parse is exercised directly by its own describe block below with its
// own mock; the top-level mock here covers the plain-text/CSV test cases
// that never touch the PDF branch.
jest.mock('pdf-parse', () => ({
    PDFParse: jest.fn().mockImplementation(() => ({
        getText: jest.fn().mockResolvedValue({ text: '' }),
        destroy: jest.fn().mockResolvedValue(undefined),
    })),
}));

import { generateText } from 'ai';
import { PDFParse } from 'pdf-parse';

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

function makePrismaMock() {
    return {
        extractionLog: {
            create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        },
    } as unknown as PrismaService;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ExtractionService', () => {
    let service: ExtractionService;
    let complianceService: ComplianceService;
    let prisma: PrismaService;

    beforeEach(() => {
        complianceService = new ComplianceService();
        prisma = makePrismaMock();
        service = new ExtractionService(complianceService, prisma);
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
            expect(typeof result.extractedInvoice).toBe('object');
            expect(result.extractedInvoice.invoiceNumber).toBe('INV-001');
            expect(typeof result.processedAt).toBe('string');
        });

        it('should call ComplianceService.mask() before calling Groq', async () => {
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

        it('should call generateText (Groq) exactly once per file', async () => {
            const file = makeFile('Total: 500 USD', 'text/plain');

            await service.processFile(file);

            expect(generateText).toHaveBeenCalledTimes(1);
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

            expect(result.file?.mimeType).toBe('text/csv');
            expect(result.maskedText).toContain('ACME Corp');
        });

        it('should write an ExtractionLog row on success', async () => {
            const file = makeFile('Total: 500 USD', 'text/plain');

            await service.processFile(file);

            expect(prisma.extractionLog.create).toHaveBeenCalledTimes(1);
            expect(prisma.extractionLog.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ success: true }) }),
            );
        });
    });

    describe('processFile() — PDF handling', () => {
        it('should extract the PDF text layer and send it to Groq', async () => {
            (PDFParse as unknown as jest.Mock).mockImplementationOnce(() => ({
                getText: jest.fn().mockResolvedValue({ text: 'Invoice total: 2000 EUR' }),
                destroy: jest.fn().mockResolvedValue(undefined),
            }));
            const file = makeFile('%PDF-1.4 fake bytes', 'application/pdf', 'invoice.pdf');

            const result = await service.processFile(file);

            expect(result.maskedText).toContain('Invoice total: 2000 EUR');
            expect(generateText).toHaveBeenCalledTimes(1);
        });

        it('should reject a PDF with no extractable text layer instead of silently sending nothing to the model', async () => {
            (PDFParse as unknown as jest.Mock).mockImplementationOnce(() => ({
                getText: jest.fn().mockResolvedValue({ text: '   ' }), // scanned/image-only PDF
                destroy: jest.fn().mockResolvedValue(undefined),
            }));
            const file = makeFile('%PDF-1.4 fake bytes', 'application/pdf', 'scanned.pdf');

            await expect(service.processFile(file)).rejects.toThrow(
                'no extractable text layer',
            );
            expect(generateText).not.toHaveBeenCalled();
        });

        it('should proceed if a scanned PDF has pasted text alongside it', async () => {
            (PDFParse as unknown as jest.Mock).mockImplementationOnce(() => ({
                getText: jest.fn().mockResolvedValue({ text: '' }),
                destroy: jest.fn().mockResolvedValue(undefined),
            }));
            const file = makeFile('%PDF-1.4 fake bytes', 'application/pdf', 'scanned.pdf');

            const result = await service.processFile(file, 'Invoice total: 750 USD');

            expect(result.maskedText).toContain('Invoice total: 750 USD');
            expect(generateText).toHaveBeenCalledTimes(1);
        });
    });
});
