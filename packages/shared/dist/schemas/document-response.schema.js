"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildResponseSchema = buildResponseSchema;
const zod_1 = require("zod");
/**
 * Wraps a document-type's data schema and confidence schema into the shape
 * passed to `generateObject()` — one wrapper reused by every entry in the
 * backend's document-type registry instead of a hand-written response schema
 * per type.
 */
function buildResponseSchema(dataSchema, confidenceSchema) {
    return zod_1.z.object({
        data: dataSchema,
        confidence: confidenceSchema,
        imagePiiDetected: zod_1.z
            .boolean()
            .describe('True if personal PII is visibly present in any provided image'),
    });
}
