import { z } from 'zod';
import {
    InvoiceSchema,
    InvoiceConfidenceSchema,
    ReceiptSchema,
    ReceiptConfidenceSchema,
    ResumeSchema,
    ResumeConfidenceSchema,
    buildResponseSchema,
} from '@maintain/shared';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DocumentTypeDescriptor {
    label: string;
    /** Passed as the `schema` option to `generateObject()`. */
    schema: z.ZodTypeAny;
    /** The full system prompt sent alongside the document content. */
    prompt: string;
}

// ── Shared prompt fragments ─────────────────────────────────────────────────

/**
 * The six-anchor confidence rubric, identical across every document type so a
 * score means the same thing regardless of what's being extracted.
 */
const CONFIDENCE_RUBRIC = `CONFIDENCE SCORING — use ONLY these six exact values for every confidence field, nothing in between:

1.0 — The exact value is explicitly printed/written in the document. You read it directly with no interpretation needed.
0.8 — The value is present but required minor interpretation: e.g. handwriting, abbreviation, non-standard date format, or reconstructing a total from other fields.
0.6 — The value is partially visible or you inferred it from strong surrounding context.
0.4 — The value is not clearly stated. You estimated it from weak indirect evidence and another reader might reach a different answer.
0.2 — You guessed. The document gives almost no reliable signal for this field.
0.0 — The field value is null (not found), OR you have no defensible basis for the extracted value.

IMPORTANT RULES:
- You MUST use only: 0.0, 0.2, 0.4, 0.6, 0.8, or 1.0. No other values.
- If a field is null (or an empty array), its confidence MUST be 0.0.
- Be honest. A document that is scanned, handwritten, or photographed at an angle should produce lower scores than a clean digital original.`;

const IMAGE_PII_CHECK = `IMAGE PII CHECK — only relevant when one or more images were provided:
- Set imagePiiDetected to true if the image(s) visibly show a personal email address, phone number, IBAN/bank account number, or credit/debit card number ANYWHERE in the frame — including outside the structured fields being extracted (e.g. in a footer, signature, stamp, or handwritten margin note).
- Routine business contact info in a normal document header does not need to be flagged; use judgement for anything that reads as a private individual's personal detail rather than routine business letterhead.
- If no image was provided at all, set imagePiiDetected to false.`;

function buildExtractionPrompt(taskDescription: string, fieldNotes: string): string {
    return `${taskDescription}

For any field you cannot locate in the document, set it to null (or an empty array for list fields).

${CONFIDENCE_RUBRIC}

${fieldNotes}

${IMAGE_PII_CHECK}`;
}

// ── Registry ─────────────────────────────────────────────────────────────────

/**
 * Every document type the extraction pipeline can classify and extract.
 * Mirrors model-registry.ts's pattern: a plain object keyed by a string,
 * resolved through a lookup rather than a switch statement. Adding a new
 * document type means adding one entry here (plus its Zod schema in
 * packages/shared) — no other file needs to branch on the type.
 */
export const DOCUMENT_TYPE_REGISTRY = {
    invoice: {
        label: 'Invoice',
        schema: buildResponseSchema(InvoiceSchema, InvoiceConfidenceSchema),
        prompt: buildExtractionPrompt(
            'You are an invoice processing assistant. Extract the invoice data from the document and populate every field you can find.',
            'Fields that are commonly absent from invoices (dueDate, taxAmount, customerAddress) should realistically score lower when the document does not make them explicit.',
        ),
    },
    receipt: {
        label: 'Receipt',
        schema: buildResponseSchema(ReceiptSchema, ReceiptConfidenceSchema),
        prompt: buildExtractionPrompt(
            'You are a receipt processing assistant. Extract the purchase/transaction data from the document and populate every field you can find.',
            'Fields that are commonly absent from receipts (tipAmount, transactionTime, paymentMethod) should realistically score lower when the document does not make them explicit.',
        ),
    },
    resume: {
        label: 'Resume/CV',
        schema: buildResponseSchema(ResumeSchema, ResumeConfidenceSchema),
        prompt: buildExtractionPrompt(
            "You are a resume/CV parsing assistant. Extract the candidate's details, work experience, and education from the document and populate every field you can find.",
            'Only extract skills and experience entries that are explicitly listed — do not infer skills from job titles or descriptions.',
        ),
    },
} as const satisfies Record<string, DocumentTypeDescriptor>;

export type DocumentTypeKey = keyof typeof DOCUMENT_TYPE_REGISTRY;

export const DOCUMENT_TYPE_KEYS = Object.keys(DOCUMENT_TYPE_REGISTRY) as DocumentTypeKey[];

/** The document type assumed when auto-classification is skipped, disabled, or inconclusive. */
export const DEFAULT_DOCUMENT_TYPE: DocumentTypeKey = 'invoice';

export function isDocumentTypeKey(value: unknown): value is DocumentTypeKey {
    return typeof value === 'string' && (DOCUMENT_TYPE_KEYS as readonly string[]).includes(value);
}

export function getDocumentTypeDescriptor(key: DocumentTypeKey): DocumentTypeDescriptor {
    return DOCUMENT_TYPE_REGISTRY[key];
}
