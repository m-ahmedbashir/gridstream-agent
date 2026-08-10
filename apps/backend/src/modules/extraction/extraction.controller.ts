import {
    Controller,
    Post,
    Get,
    UploadedFile,
    UseInterceptors,
    Body,
    HttpCode,
    HttpStatus,
    ParseFilePipe,
    MaxFileSizeValidator,
    FileTypeValidator,
    Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ExtractionService, ExtractionResult } from './extraction.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UsersService } from '../users/users.service';

/**
 * ExtractionController
 *
 * Handles document upload and extraction requests (invoices, receipts, resumes, ...).
 * All routes are prefixed with /extraction.
 */
@Controller('extraction')
export class ExtractionController {
    private readonly logger = new Logger(ExtractionController.name);

    constructor(
        private readonly extractionService: ExtractionService,
        private readonly usersService: UsersService,
    ) { }

    /** GET /extraction/models — the registry, so the frontend's picker never hand-duplicates it. */
    @Get('models')
    getModels() {
        return this.extractionService.getModels();
    }

    /** GET /extraction/document-types — the document-type registry, same pattern as /extraction/models. */
    @Get('document-types')
    getDocumentTypes() {
        return this.extractionService.getDocumentTypes();
    }

    /**
     * POST /extraction/upload
     *
     * Accepts a single multipart file field named "file" plus optional
     * metadata fields (documentType, currency, notes, userId) defined in UploadDocumentDto.
     *
     * Pipeline:
     *   1. Multer stores the file in memory (no disk writes).
     *   2. NestJS validates file size (≤ 10 MB) and MIME type.
     *   3. If a userId was supplied, look up that user's saved model preference.
     *   4. ExtractionService.processFile() masks PII, classifies the document type
     *      (unless one was explicitly supplied), and calls the configured model.
     *   5. Returns a structured ExtractionResult JSON response.
     */
    @Get('stats')
    async getStats() {
        return this.extractionService.getStats();
    }

    @Post('upload')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(), // keep file in memory — no temp disk files
            limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB hard limit at multer level
        }),
    )
    async uploadDocument(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
                    new FileTypeValidator({
                        fileType:
                            /^(text\/plain|text\/csv|application\/json|application\/pdf|image\/(png|jpeg|webp))$/,
                    }),
                ],
                fileIsRequired: false,
            }),
        )
        file: Express.Multer.File | undefined,
        @Body() dto: UploadDocumentDto,
    ): Promise<ExtractionResult> {
        this.logger.log(
            `Received upload request: file=${file?.originalname ?? 'none'} text=${dto.text ? 'provided' : 'none'}`,
        );

        // No userId supplied (anonymous/local-dev caller) just uses ExtractionService's own defaults.
        // Note: never log `apiKeyOverride` — it's a decrypted plaintext provider key.
        let modelKey: string | undefined;
        let apiKeyOverride: string | undefined;
        let userProcessingMode: string | undefined;
        if (dto.userId) {
            const [settings, key] = await Promise.all([
                this.usersService.getSettings(dto.userId),
                this.usersService.getDecryptedApiKey(dto.userId),
            ]);
            modelKey = settings.modelKey;
            userProcessingMode = settings.processingMode;
            apiKeyOverride = key;
        }

        return this.extractionService.processFile(
            file,
            dto.text,
            modelKey,
            apiKeyOverride,
            dto.processingMode || userProcessingMode,
            dto.documentType,
        );
    }
}
