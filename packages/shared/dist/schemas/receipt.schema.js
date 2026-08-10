"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptConfidenceSchema = exports.ReceiptSchema = exports.ReceiptItemSchema = void 0;
const zod_1 = require("zod");
exports.ReceiptItemSchema = zod_1.z.object({
    description: zod_1.z.string().describe('Item description'),
    quantity: zod_1.z.number().describe('Item quantity'),
    unitPrice: zod_1.z.number().describe('Price per unit'),
    totalPrice: zod_1.z.number().describe('Total price for this item'),
});
/**
 * Nullable receipt schema — every field is optional/nullable because the model
 * may not find a value for every field in every document. Same convention as
 * InvoiceSchema.
 */
exports.ReceiptSchema = zod_1.z.object({
    merchantName: zod_1.z.string().nullable().describe('Merchant/store name, or null if not found'),
    merchantAddress: zod_1.z.string().nullable().describe('Merchant address, or null if not found'),
    transactionDate: zod_1.z.string().nullable().describe('Date of the transaction, or null if not found'),
    transactionTime: zod_1.z.string().nullable().describe('Time of the transaction, or null if not found'),
    items: zod_1.z.array(exports.ReceiptItemSchema).describe('Array of purchased items — empty array if none found'),
    subtotal: zod_1.z.number().nullable().describe('Subtotal amount, or null if not found'),
    taxAmount: zod_1.z.number().nullable().describe('Tax amount, or null if not found'),
    tipAmount: zod_1.z.number().nullable().describe('Tip/gratuity amount, or null if not found'),
    totalAmount: zod_1.z.number().nullable().describe('Total amount paid, or null if not found'),
    currency: zod_1.z.string().nullable().describe('Currency code (e.g., USD), or null if not found'),
    paymentMethod: zod_1.z.string().nullable().describe('Payment method (e.g., cash, card, ...), or null if not found'),
});
/**
 * Confidence score for each extracted receipt field.
 * Uses the same six-anchor scale as InvoiceConfidenceSchema: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0.
 */
exports.ReceiptConfidenceSchema = zod_1.z.object({
    merchantName: zod_1.z.number().describe('Confidence score 0.0-1.0 for merchantName'),
    merchantAddress: zod_1.z.number().describe('Confidence score 0.0-1.0 for merchantAddress'),
    transactionDate: zod_1.z.number().describe('Confidence score 0.0-1.0 for transactionDate'),
    transactionTime: zod_1.z.number().describe('Confidence score 0.0-1.0 for transactionTime'),
    items: zod_1.z.number().describe('Confidence score 0.0-1.0 for the items array as a whole'),
    subtotal: zod_1.z.number().describe('Confidence score 0.0-1.0 for subtotal'),
    taxAmount: zod_1.z.number().describe('Confidence score 0.0-1.0 for taxAmount'),
    tipAmount: zod_1.z.number().describe('Confidence score 0.0-1.0 for tipAmount'),
    totalAmount: zod_1.z.number().describe('Confidence score 0.0-1.0 for totalAmount'),
    currency: zod_1.z.number().describe('Confidence score 0.0-1.0 for currency'),
    paymentMethod: zod_1.z.number().describe('Confidence score 0.0-1.0 for paymentMethod'),
});
