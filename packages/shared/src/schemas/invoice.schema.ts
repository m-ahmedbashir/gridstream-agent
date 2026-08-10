import { z } from 'zod';

export const InvoiceLineItemSchema = z.object({
    description: z.string().describe('Item description'),
    quantity: z.number().describe('Item quantity'),
    unitPrice: z.number().describe('Price per unit'),
    totalPrice: z.number().describe('Total price for this line item'),
});

/**
 * Nullable invoice schema — every field is optional/nullable because the model
 * may not find a value for every field in every document. The runtime always
 * produced nulls here; the types now reflect that truthfully.
 *
 * @deprecated Invoice extraction is kept for backward compatibility; new work
 * should use the maintenance schemas in `maintenance.schema.ts`.
 */
export const InvoiceSchema = z.object({
    invoiceNumber: z.string().nullable().describe('Invoice number or ID, or null if not found'),
    issueDate: z.string().nullable().describe('Issue date of the invoice, or null if not found'),
    dueDate: z.string().nullable().describe('Payment due date, or null if not found'),
    vendorName: z.string().nullable().describe('Vendor/supplier name, or null if not found'),
    vendorAddress: z.string().nullable().describe('Vendor address, or null if not found'),
    customerName: z.string().nullable().describe('Customer/buyer name, or null if not found'),
    customerAddress: z.string().nullable().describe('Customer address, or null if not found'),
    lineItems: z.array(InvoiceLineItemSchema).describe('Array of line items — empty array if none found'),
    subtotal: z.number().nullable().describe('Subtotal amount, or null if not found'),
    taxAmount: z.number().nullable().describe('Tax amount, or null if not found'),
    totalAmount: z.number().nullable().describe('Total invoice amount, or null if not found'),
    currency: z.string().nullable().describe('Currency code (e.g., USD), or null if not found'),
});

export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;

/**
 * Confidence score for each extracted invoice field.
 * Uses a six-anchor scale: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0 — see extraction.service.ts for the rubric.
 */
export const InvoiceConfidenceSchema = z.object({
    invoiceNumber: z.number().describe('Confidence score 0.0–1.0 for invoiceNumber'),
    issueDate: z.number().describe('Confidence score 0.0–1.0 for issueDate'),
    dueDate: z.number().describe('Confidence score 0.0–1.0 for dueDate'),
    vendorName: z.number().describe('Confidence score 0.0–1.0 for vendorName'),
    vendorAddress: z.number().describe('Confidence score 0.0–1.0 for vendorAddress'),
    customerName: z.number().describe('Confidence score 0.0–1.0 for customerName'),
    customerAddress: z.number().describe('Confidence score 0.0–1.0 for customerAddress'),
    subtotal: z.number().describe('Confidence score 0.0–1.0 for subtotal'),
    taxAmount: z.number().describe('Confidence score 0.0–1.0 for taxAmount'),
    totalAmount: z.number().describe('Confidence score 0.0–1.0 for totalAmount'),
    currency: z.number().describe('Confidence score 0.0–1.0 for currency'),
    lineItems: z.number().describe('Confidence score 0.0–1.0 for the line items array as a whole'),
});

export type InvoiceConfidence = z.infer<typeof InvoiceConfidenceSchema>;

