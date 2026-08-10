import { z } from 'zod';
/**
 * Wraps a document-type's data schema and confidence schema into the shape
 * passed to `generateObject()` — one wrapper reused by every entry in the
 * backend's document-type registry instead of a hand-written response schema
 * per type.
 */
export declare function buildResponseSchema<D extends z.ZodTypeAny, C extends z.ZodTypeAny>(dataSchema: D, confidenceSchema: C): z.ZodObject<{
    data: D;
    confidence: C;
    imagePiiDetected: z.ZodBoolean;
}, z.core.$strip>;
