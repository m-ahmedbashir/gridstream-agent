import { z } from 'zod';
export declare const InvoiceLineItemSchema: z.ZodObject<{
    description: z.ZodString;
    quantity: z.ZodNumber;
    unitPrice: z.ZodNumber;
    totalPrice: z.ZodNumber;
}, z.core.$strip>;
/**
 * Nullable invoice schema — every field is optional/nullable because the model
 * may not find a value for every field in every document. The runtime always
 * produced nulls here; the types now reflect that truthfully.
 *
 * @deprecated Invoice extraction is kept for backward compatibility; new work
 * should use the maintenance schemas in `maintenance.schema.ts`.
 */
export declare const InvoiceSchema: z.ZodObject<{
    invoiceNumber: z.ZodNullable<z.ZodString>;
    issueDate: z.ZodNullable<z.ZodString>;
    dueDate: z.ZodNullable<z.ZodString>;
    vendorName: z.ZodNullable<z.ZodString>;
    vendorAddress: z.ZodNullable<z.ZodString>;
    customerName: z.ZodNullable<z.ZodString>;
    customerAddress: z.ZodNullable<z.ZodString>;
    lineItems: z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        totalPrice: z.ZodNumber;
    }, z.core.$strip>>;
    subtotal: z.ZodNullable<z.ZodNumber>;
    taxAmount: z.ZodNullable<z.ZodNumber>;
    totalAmount: z.ZodNullable<z.ZodNumber>;
    currency: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;
/**
 * Confidence score for each extracted invoice field.
 * Uses a six-anchor scale: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0 — see extraction.service.ts for the rubric.
 */
export declare const InvoiceConfidenceSchema: z.ZodObject<{
    invoiceNumber: z.ZodNumber;
    issueDate: z.ZodNumber;
    dueDate: z.ZodNumber;
    vendorName: z.ZodNumber;
    vendorAddress: z.ZodNumber;
    customerName: z.ZodNumber;
    customerAddress: z.ZodNumber;
    subtotal: z.ZodNumber;
    taxAmount: z.ZodNumber;
    totalAmount: z.ZodNumber;
    currency: z.ZodNumber;
    lineItems: z.ZodNumber;
}, z.core.$strip>;
export type InvoiceConfidence = z.infer<typeof InvoiceConfidenceSchema>;
