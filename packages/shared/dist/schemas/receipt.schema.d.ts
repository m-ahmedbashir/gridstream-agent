import { z } from 'zod';
export declare const ReceiptItemSchema: z.ZodObject<{
    description: z.ZodString;
    quantity: z.ZodNumber;
    unitPrice: z.ZodNumber;
    totalPrice: z.ZodNumber;
}, z.core.$strip>;
/**
 * Nullable receipt schema — every field is optional/nullable because the model
 * may not find a value for every field in every document. Same convention as
 * InvoiceSchema.
 */
export declare const ReceiptSchema: z.ZodObject<{
    merchantName: z.ZodNullable<z.ZodString>;
    merchantAddress: z.ZodNullable<z.ZodString>;
    transactionDate: z.ZodNullable<z.ZodString>;
    transactionTime: z.ZodNullable<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        totalPrice: z.ZodNumber;
    }, z.core.$strip>>;
    subtotal: z.ZodNullable<z.ZodNumber>;
    taxAmount: z.ZodNullable<z.ZodNumber>;
    tipAmount: z.ZodNullable<z.ZodNumber>;
    totalAmount: z.ZodNullable<z.ZodNumber>;
    currency: z.ZodNullable<z.ZodString>;
    paymentMethod: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type Receipt = z.infer<typeof ReceiptSchema>;
export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;
/**
 * Confidence score for each extracted receipt field.
 * Uses the same six-anchor scale as InvoiceConfidenceSchema: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0.
 */
export declare const ReceiptConfidenceSchema: z.ZodObject<{
    merchantName: z.ZodNumber;
    merchantAddress: z.ZodNumber;
    transactionDate: z.ZodNumber;
    transactionTime: z.ZodNumber;
    items: z.ZodNumber;
    subtotal: z.ZodNumber;
    taxAmount: z.ZodNumber;
    tipAmount: z.ZodNumber;
    totalAmount: z.ZodNumber;
    currency: z.ZodNumber;
    paymentMethod: z.ZodNumber;
}, z.core.$strip>;
export type ReceiptConfidence = z.infer<typeof ReceiptConfidenceSchema>;
