import { z } from 'zod';

/**
 * Wraps a document-type's data schema and confidence schema into the shape
 * passed to `generateObject()` — one wrapper reused by every entry in the
 * backend's document-type registry instead of a hand-written response schema
 * per type.
 */
export function buildResponseSchema<D extends z.ZodTypeAny, C extends z.ZodTypeAny>(
    dataSchema: D,
    confidenceSchema: C,
) {
    return z.object({
        data: dataSchema,
        confidence: confidenceSchema,
        imagePiiDetected: z
            .boolean()
            .describe('True if personal PII is visibly present in any provided image'),
    });
}
