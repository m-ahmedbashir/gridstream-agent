import { z } from 'zod';

export const ReceiptItemSchema = z.object({
    description: z.string().describe('Item description'),
    quantity: z.number().describe('Item quantity'),
    unitPrice: z.number().describe('Price per unit'),
    totalPrice: z.number().describe('Total price for this item'),
});

/**
 * Nullable receipt schema — every field is optional/nullable because the model
 * may not find a value for every field in every document. Same convention as
 * InvoiceSchema.
 */
export const ReceiptSchema = z.object({
    merchantName: z.string().nullable().describe('Merchant/store name, or null if not found'),
    merchantAddress: z.string().nullable().describe('Merchant address, or null if not found'),
    transactionDate: z.string().nullable().describe('Date of the transaction, or null if not found'),
    transactionTime: z.string().nullable().describe('Time of the transaction, or null if not found'),
    items: z.array(ReceiptItemSchema).describe('Array of purchased items — empty array if none found'),
    subtotal: z.number().nullable().describe('Subtotal amount, or null if not found'),
    taxAmount: z.number().nullable().describe('Tax amount, or null if not found'),
    tipAmount: z.number().nullable().describe('Tip/gratuity amount, or null if not found'),
    totalAmount: z.number().nullable().describe('Total amount paid, or null if not found'),
    currency: z.string().nullable().describe('Currency code (e.g., USD), or null if not found'),
    paymentMethod: z.string().nullable().describe('Payment method (e.g., cash, card, ...), or null if not found'),
});

export type Receipt = z.infer<typeof ReceiptSchema>;
export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;

/**
 * Confidence score for each extracted receipt field.
 * Uses the same six-anchor scale as InvoiceConfidenceSchema: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0.
 */
export const ReceiptConfidenceSchema = z.object({
    merchantName: z.number().describe('Confidence score 0.0-1.0 for merchantName'),
    merchantAddress: z.number().describe('Confidence score 0.0-1.0 for merchantAddress'),
    transactionDate: z.number().describe('Confidence score 0.0-1.0 for transactionDate'),
    transactionTime: z.number().describe('Confidence score 0.0-1.0 for transactionTime'),
    items: z.number().describe('Confidence score 0.0-1.0 for the items array as a whole'),
    subtotal: z.number().describe('Confidence score 0.0-1.0 for subtotal'),
    taxAmount: z.number().describe('Confidence score 0.0-1.0 for taxAmount'),
    tipAmount: z.number().describe('Confidence score 0.0-1.0 for tipAmount'),
    totalAmount: z.number().describe('Confidence score 0.0-1.0 for totalAmount'),
    currency: z.number().describe('Confidence score 0.0-1.0 for currency'),
    paymentMethod: z.number().describe('Confidence score 0.0-1.0 for paymentMethod'),
});

export type ReceiptConfidence = z.infer<typeof ReceiptConfidenceSchema>;
