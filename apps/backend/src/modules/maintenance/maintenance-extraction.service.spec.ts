import { MaintenanceExtractionService } from './maintenance-extraction.service';
import { ComplianceService } from '../compliance/compliance.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OcrService } from '../extraction/ocr.service';

jest.mock('ai', () => ({
    generateText: jest.fn().mockResolvedValue({
        text: JSON.stringify({
            data: {
                machineId: 'CNC-001',
                machineType: 'CNC',
                manufacturer: 'DMG MORI',
                yearInstalled: 2021,
                runtimeHours: 14500,
                lastServiceDate: '2023-08-15T00:00:00.000Z',
                observedIssues: ['Spindel läuft unrund', 'Kühlmittelstand zu niedrig'],
                energyConsumptionKwh: 45,
                criticality: 'high',
                location: 'Halle 3',
            },
            confidence: {
                machineId: 1.0,
                machineType: 1.0,
                manufacturer: 1.0,
                yearInstalled: 1.0,
                runtimeHours: 1.0,
                lastServiceDate: 1.0,
                observedIssues: 1.0,
                energyConsumptionKwh: 1.0,
                criticality: 1.0,
                location: 1.0,
            },
            imagePiiDetected: false,
        }),
    }),
}));

jest.mock('@ai-sdk/groq', () => ({
    createGroq: jest.fn().mockReturnValue(jest.fn((modelId: string) => `groq-model:${modelId}`)),
}));

jest.mock('pdf-parse', () => ({
    PDFParse: jest.fn().mockImplementation(() => ({
        getText: jest.fn().mockResolvedValue({ text: '' }),
        getScreenshot: jest.fn().mockResolvedValue({ pages: [{ data: new Uint8Array([1, 2, 3]) }] }),
        destroy: jest.fn().mockResolvedValue(undefined),
    })),
}));

jest.mock('tesseract.js', () => ({
    createWorker: jest.fn().mockResolvedValue({
        recognize: jest.fn().mockResolvedValue({ data: { text: '', confidence: 0 } }),
        terminate: jest.fn().mockResolvedValue(undefined),
    }),
}));

import { generateText } from 'ai';

describe('MaintenanceExtractionService', () => {
    let service: MaintenanceExtractionService;
    let complianceService: ComplianceService;
    let prismaMock: any;

    beforeEach(() => {
        complianceService = new ComplianceService();
        prismaMock = {
            extractionLog: {
                create: jest.fn().mockResolvedValue({ id: 'log-1' }),
            },
            user: {
                upsert: jest.fn().mockResolvedValue({ id: 'user-1' }),
                findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
            },
            machineProfile: {
                upsert: jest.fn().mockResolvedValue({ id: 'profile-1' }),
            },
        };
        service = new MaintenanceExtractionService(complianceService, prismaMock as unknown as PrismaService);
        jest.clearAllMocks();
    });

    function makeFile(content: string, mimeType = 'text/plain', name = 'report.txt'): Express.Multer.File {
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

    it('extracts a maintenance report and returns a MachineProfile', async () => {
        const file = makeFile('Maschinen-ID: CNC-001\nHersteller: DMG MORI');

        const result = await service.processFile('user-1', file);

        expect(result.extractedData.machineId).toBe('CNC-001');
        expect(result.extractedData.machineType).toBe('CNC');
        expect(result.sourceType).toBe('TEXT');
    });

    it('masks PII before sending to the model', async () => {
        const maskSpy = jest.spyOn(complianceService, 'mask');
        const file = makeFile('Kontakt: techniker@example.com');

        await service.processFile('user-1', file);

        expect(maskSpy).toHaveBeenCalledTimes(1);
        const maskedText = (generateText as jest.Mock).mock.calls[0][0].messages[0].content.find((p: any) => p.type === 'text' && p.text.includes('Document text'))?.text;
        expect(maskedText).not.toContain('techniker@example.com');
        expect(maskedText).toContain('[REDACTED:EMAIL]');
    });

    it('flags piiDetected when the report contains an email', async () => {
        const file = makeFile('Kontakt: service@werk.de');

        const result = await service.processFile('user-1', file);

        expect(result.piiDetected).toBe(true);
        expect(result.maskedText).not.toContain('service@werk.de');
    });

    it('writes an ExtractionLog row on success', async () => {
        const file = makeFile('Maschinen-ID: CNC-001');

        await service.processFile('user-1', file);

        expect(prismaMock.extractionLog.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.extractionLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    success: true,
                    documentType: 'maintenance_report',
                }),
            }),
        );
    });

    it('persists the extracted machine profile to the database', async () => {
        const file = makeFile('Maschinen-ID: CNC-001');

        await service.processFile('user-1', file);

        expect(prismaMock.machineProfile.upsert).toHaveBeenCalledTimes(1);
        const upsertCall = prismaMock.machineProfile.upsert.mock.calls[0][0];
        expect(upsertCall.where).toEqual({ machineId: 'CNC-001' });
    });

    it('returns machineProfileId from the persisted profile', async () => {
        prismaMock.machineProfile.upsert.mockResolvedValue({ id: 'profile-123' });
        const file = makeFile('Maschinen-ID: CNC-001');

        const result = await service.processFile('user-1', file);

        expect(result.machineProfileId).toBe('profile-123');
    });
});
