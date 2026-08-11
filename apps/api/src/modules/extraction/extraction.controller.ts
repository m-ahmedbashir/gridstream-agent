import { Controller, Get } from '@nestjs/common';
import { MODEL_REGISTRY, type ModelKey } from './model-registry';

@Controller('extraction')
export class ExtractionController {
    /**
     * Serves the model registry so the frontend never hand-duplicates the
     * list — this is the single source of truth both the Settings page and
     * the upload screen's model picker read from.
     */
    @Get('models')
    listModels() {
        return (Object.keys(MODEL_REGISTRY) as ModelKey[]).map((key) => ({
            key,
            ...MODEL_REGISTRY[key],
        }));
    }
}
