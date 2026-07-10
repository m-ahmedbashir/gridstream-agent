import { ExtractionService, ExtractionResult } from './extraction.service';
import { ComplianceService } from '../compliance/compliance.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock the SDK boundary so tests never touch the network. The real service
// calls `generateObject` from `ai`, using a model built by `createGroq` from
// `@ai-sdk/groq` — mock exactly those, not the earlier Gemini-era imports.
jest.mock('ai', () => ({
    generateObject: jest.fn().mockResolvedValue({
        object: {
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
            imagePiiDetected: false,
        },
    }),
}));

// Each provider mock returns a distinguishable string so tests can assert on
// exactly which model the registry resolved to, without needing a real SDK.
jest.mock('@ai-sdk/groq', () => ({
    createGroq: jest.fn().mockReturnValue(jest.fn((modelId: string) => `groq-model:${modelId}`)),
}));

jest.mock('@ai-sdk/openai', () => ({
    createOpenAI: jest.fn().mockReturnValue(jest.fn((modelId: string) => `openai-model:${modelId}`)),
}));

jest.mock('@ai-sdk/anthropic', () => ({
    createAnthropic: jest.fn().mockReturnValue(jest.fn((modelId: string) => `anthropic-model:${modelId}`)),
}));

// pdf-parse is exercised directly by its own describe block below with its
// own per-test overrides; this default covers the plain-text/CSV test cases
// that never touch the PDF branch at all.
jest.mock('pdf-parse', () => ({
    PDFParse: jest.fn().mockImplementation(() => ({
        getText: jest.fn().mockResolvedValue({ text: '' }),
        getScreenshot: jest.fn().mockResolvedValue({ pages: [{ data: new Uint8Array([1, 2, 3]) }] }),
        destroy: jest.fn().mockResolvedValue(undefined),
    })),
}));

import { generateObject } from 'ai';
import { createGroq } from '@ai-sdk/groq';
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

/** One mock PDFParse instance covering whichever method the test needs. */
function mockPdfParseInstance(opts: { text?: string; screenshotPages?: Array<{ data: Uint8Array }> | null } = {}) {
    return {
        getText: jest.fn().mockResolvedValue({ text: opts.text ?? '' }),
        getScreenshot: opts.screenshotPages === null
            ? jest.fn().mockRejectedValue(new Error('rasterization failed'))
            : jest.fn().mockResolvedValue({ pages: opts.screenshotPages ?? [{ data: new Uint8Array([1, 2, 3]) }] }),
        destroy: jest.fn().mockResolvedValue(undefined),
    };
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

        it('should call generateObject (Groq) exactly once per file', async () => {
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
            (PDFParse as unknown as jest.Mock).mockImplementationOnce(() =>
                mockPdfParseInstance({ text: 'Invoice total: 2000 EUR' }),
            );
            const file = makeFile('%PDF-1.4 fake bytes', 'application/pdf', 'invoice.pdf');

            const result = await service.processFile(file);

            expect(result.maskedText).toContain('Invoice total: 2000 EUR');
            expect(generateObject).toHaveBeenCalledTimes(1);
        });

        it('should render page 1 to an image and use the vision path when a PDF has no text layer', async () => {
            // First construction (extractText → getText) reports no text;
            // second construction (renderPdfPagesToImages → getScreenshot) succeeds.
            (PDFParse as unknown as jest.Mock)
                .mockImplementationOnce(() => mockPdfParseInstance({ text: '   ' }))
                .mockImplementationOnce(() => mockPdfParseInstance({ screenshotPages: [{ data: new Uint8Array([9, 9, 9]) }] }));

            const file = makeFile('%PDF-1.4 fake bytes', 'application/pdf', 'scanned.pdf');

            const result = await service.processFile(file);

            expect(generateObject).toHaveBeenCalledTimes(1);
            expect(result.extractedInvoice.invoiceNumber).toBe('INV-001');
        });

        it('should render every rasterized page as a separate image block sent to Groq', async () => {
            (PDFParse as unknown as jest.Mock)
                .mockImplementationOnce(() => mockPdfParseInstance({ text: '' }))
                .mockImplementationOnce(() => mockPdfParseInstance({
                    screenshotPages: [
                        { data: new Uint8Array([1]) },
                        { data: new Uint8Array([2]) },
                        { data: new Uint8Array([3]) },
                    ],
                }));

            const file = makeFile('%PDF-1.4 fake bytes', 'application/pdf', 'multipage-scanned.pdf');
            await service.processFile(file);

            const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
            const imageBlocks = callArgs.messages[0].content.filter((part: any) => part.type === 'image');
            expect(imageBlocks).toHaveLength(3);
        });

        it('should throw when a PDF has no text layer and rasterization also fails', async () => {
            (PDFParse as unknown as jest.Mock)
                .mockImplementationOnce(() => mockPdfParseInstance({ text: '' }))
                .mockImplementationOnce(() => mockPdfParseInstance({ screenshotPages: null })); // getScreenshot rejects

            const file = makeFile('%PDF-1.4 fake bytes', 'application/pdf', 'unreadable.pdf');

            await expect(service.processFile(file)).rejects.toThrow(
                'could not be rendered as an image',
            );
            expect(generateObject).not.toHaveBeenCalled();
        });

        it('should proceed via the text path if a scanned PDF has pasted text alongside it (no rasterization needed)', async () => {
            (PDFParse as unknown as jest.Mock).mockImplementationOnce(() =>
                mockPdfParseInstance({ text: '' }),
            );
            const file = makeFile('%PDF-1.4 fake bytes', 'application/pdf', 'scanned.pdf');

            const result = await service.processFile(file, 'Invoice total: 750 USD');

            expect(result.maskedText).toContain('Invoice total: 750 USD');
            expect(generateObject).toHaveBeenCalledTimes(1);
            expect(PDFParse).toHaveBeenCalledTimes(1); // only the text-layer attempt — no rasterization fallback triggered
        });
    });

    describe('processFile() — imagePiiDetected', () => {
        function makeImageFile(name = 'photo.png') {
            return makeFile('fake png bytes', 'image/png', name);
        }

        it('defaults to false when the model does not report the field', async () => {
            const result = await service.processFile(makeImageFile());
            expect(result.imagePiiDetected).toBe(false);
        });

        it('is true when an image was sent and the model flags visible PII', async () => {
            (generateObject as jest.Mock).mockResolvedValueOnce({
                object: {
                    invoice: { invoiceNumber: 'INV-002' },
                    confidence: {},
                    imagePiiDetected: true,
                },
            });

            const result = await service.processFile(makeImageFile());
            expect(result.imagePiiDetected).toBe(true);
        });

        it('is forced to false even if the model claims it when no image was actually sent', async () => {
            (generateObject as jest.Mock).mockResolvedValueOnce({
                object: {
                    invoice: { invoiceNumber: 'INV-003' },
                    confidence: {},
                    imagePiiDetected: true, // the model shouldn't say this with no image, but never trust it
                },
            });

            const file = makeFile('Total: 500 USD', 'text/plain');
            const result = await service.processFile(file);
            expect(result.imagePiiDetected).toBe(false);
        });
    });

    describe('processFile() — model registry', () => {
        it('resolves the default model (groq:llama-4-scout) when no modelKey is configured', async () => {
            const file = makeFile('Total: 500 USD', 'text/plain');
            await service.processFile(file);

            const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
            expect(callArgs.model).toBe('groq-model:meta-llama/llama-4-scout-17b-16e-instruct');
        });

        it('resolves a different registry entry when the service is configured with a different modelKey', async () => {
            const textOnlyService = new ExtractionService(complianceService, prisma, 'groq:llama-3.3-70b');
            const file = makeFile('Total: 500 USD', 'text/plain');

            await textOnlyService.processFile(file);

            const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
            expect(callArgs.model).toBe('groq-model:llama-3.3-70b-versatile');
        });

        it('resolves an OpenAI model through the same registry, provider-agnostically', async () => {
            const openAiService = new ExtractionService(complianceService, prisma, 'openai:gpt-4o');
            const file = makeFile('Total: 500 USD', 'text/plain');

            await openAiService.processFile(file);

            const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
            expect(callArgs.model).toBe('openai-model:gpt-4o');
        });

        it('rejects an image request outright when the configured model does not support vision', async () => {
            const textOnlyService = new ExtractionService(complianceService, prisma, 'groq:llama-3.3-70b');
            const file = makeFile('fake png bytes', 'image/png', 'photo.png');

            await expect(textOnlyService.processFile(file)).rejects.toThrow(
                "doesn't support image input",
            );
            expect(generateObject).not.toHaveBeenCalled();
        });

        it('still allows a text-only model to process a request with no image', async () => {
            const textOnlyService = new ExtractionService(complianceService, prisma, 'groq:llama-3.3-70b');
            const file = makeFile('Total: 500 USD', 'text/plain');

            await expect(textOnlyService.processFile(file)).resolves.toBeDefined();
            expect(generateObject).toHaveBeenCalledTimes(1);
        });
    });

    describe('getModels()', () => {
        it('returns the registry as a flat list the frontend can render directly', () => {
            const models = service.getModels();
            expect(models).toContainEqual(
                expect.objectContaining({ key: 'groq:llama-4-scout', supportsVision: true }),
            );
            expect(models).toContainEqual(
                expect.objectContaining({ key: 'groq:llama-3.3-70b', supportsVision: false }),
            );
        });
    });

    describe('processFile() — per-request modelKey override (Phase 2)', () => {
        it('uses the per-request modelKey instead of the instance default when one is provided', async () => {
            // service defaults to groq:llama-4-scout (no constructor override)
            const file = makeFile('Total: 500 USD', 'text/plain');

            await service.processFile(file, undefined, 'openai:gpt-4o');

            const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
            expect(callArgs.model).toBe('openai-model:gpt-4o');
        });

        it('falls back to the instance default when the requested modelKey is not a recognised registry key', async () => {
            const file = makeFile('Total: 500 USD', 'text/plain');

            await service.processFile(file, undefined, 'not-a-real-model');

            const callArgs = (generateObject as jest.Mock).mock.calls[0][0];
            expect(callArgs.model).toBe('groq-model:meta-llama/llama-4-scout-17b-16e-instruct');
        });

        it('still applies the vision-capability guard to a per-request override, not just the instance default', async () => {
            const file = makeFile('fake png bytes', 'image/png', 'photo.png');

            await expect(
                service.processFile(file, undefined, 'groq:llama-3.3-70b'),
            ).rejects.toThrow("doesn't support image input");
            expect(generateObject).not.toHaveBeenCalled();
        });
    });

    describe('processFile() — BYOK apiKeyOverride (Phase 3)', () => {
        it('uses the app default env key when no apiKeyOverride is supplied', async () => {
            const file = makeFile('Total: 500 USD', 'text/plain');
            await service.processFile(file);

            const createGroqArgs = (createGroq as jest.Mock).mock.calls.at(-1)![0];
            expect(createGroqArgs.apiKey).toBe(process.env.GROQ_API_KEY);
        });

        it("passes the caller's decrypted key straight to the provider SDK instead of the app's shared key", async () => {
            const file = makeFile('Total: 500 USD', 'text/plain');
            await service.processFile(file, undefined, undefined, 'sk-users-own-decrypted-key');

            const createGroqArgs = (createGroq as jest.Mock).mock.calls.at(-1)![0];
            expect(createGroqArgs.apiKey).toBe('sk-users-own-decrypted-key');
        });

        it('never includes the apiKeyOverride in the thrown error message if the model call fails', async () => {
            (generateObject as jest.Mock).mockRejectedValueOnce(
                new Error('Request failed for key sk-users-own-decrypted-key: invalid_api_key'),
            );
            const file = makeFile('Total: 500 USD', 'text/plain');

            await expect(
                service.processFile(file, undefined, undefined, 'sk-users-own-decrypted-key'),
            ).rejects.toThrow(); // still fails — this test only cares that the key never leaks

            // The scrubbed message is what actually gets persisted to ExtractionLog.
            const logCall = (prisma.extractionLog.create as jest.Mock).mock.calls.find(
                (call) => call[0].data.success === false,
            );
            expect(logCall![0].data.errorMessage).not.toContain('sk-users-own-decrypted-key');
            expect(logCall![0].data.errorMessage).toContain('[REDACTED:API_KEY]');
        });
    });
});
