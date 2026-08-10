"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceConfidenceSchema = exports.InvoiceSchema = exports.InvoiceLineItemSchema = void 0;
const zod_1 = require("zod");
exports.InvoiceLineItemSchema = zod_1.z.object({
    description: zod_1.z.string().describe('Item description'),
    quantity: zod_1.z.number().describe('Item quantity'),
    unitPrice: zod_1.z.number().describe('Price per unit'),
    totalPrice: zod_1.z.number().describe('Total price for this line item'),
});
/**
 * Nullable invoice schema — every field is optional/nullable because the model
 * may not find a value for every field in every document. The runtime always
 * produced nulls here; the types now reflect that truthfully.
 */
exports.InvoiceSchema = zod_1.z.object({
    invoiceNumber: zod_1.z.string().nullable().describe('Invoice number or ID, or null if not found'),
    issueDate: zod_1.z.string().nullable().describe('Issue date of the invoice, or null if not found'),
    dueDate: zod_1.z.string().nullable().describe('Payment due date, or null if not found'),
    vendorName: zod_1.z.string().nullable().describe('Vendor/supplier name, or null if not found'),
    vendorAddress: zod_1.z.string().nullable().describe('Vendor address, or null if not found'),
    customerName: zod_1.z.string().nullable().describe('Customer/buyer name, or null if not found'),
    customerAddress: zod_1.z.string().nullable().describe('Customer address, or null if not found'),
    lineItems: zod_1.z.array(exports.InvoiceLineItemSchema).describe('Array of line items — empty array if none found'),
    subtotal: zod_1.z.number().nullable().describe('Subtotal amount, or null if not found'),
    taxAmount: zod_1.z.number().nullable().describe('Tax amount, or null if not found'),
    totalAmount: zod_1.z.number().nullable().describe('Total invoice amount, or null if not found'),
    currency: zod_1.z.string().nullable().describe('Currency code (e.g., USD), or null if not found'),
});
/**
 * Confidence score for each extracted invoice field.
 * Uses a six-anchor scale: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0 — see extraction.service.ts for the rubric.
 */
exports.InvoiceConfidenceSchema = zod_1.z.object({
    invoiceNumber: zod_1.z.number().describe('Confidence score 0.0–1.0 for invoiceNumber'),
    issueDate: zod_1.z.number().describe('Confidence score 0.0–1.0 for issueDate'),
    dueDate: zod_1.z.number().describe('Confidence score 0.0–1.0 for dueDate'),
    vendorName: zod_1.z.number().describe('Confidence score 0.0–1.0 for vendorName'),
    vendorAddress: zod_1.z.number().describe('Confidence score 0.0–1.0 for vendorAddress'),
    customerName: zod_1.z.number().describe('Confidence score 0.0–1.0 for customerName'),
    customerAddress: zod_1.z.number().describe('Confidence score 0.0–1.0 for customerAddress'),
    subtotal: zod_1.z.number().describe('Confidence score 0.0–1.0 for subtotal'),
    taxAmount: zod_1.z.number().describe('Confidence score 0.0–1.0 for taxAmount'),
    totalAmount: zod_1.z.number().describe('Confidence score 0.0–1.0 for totalAmount'),
    currency: zod_1.z.number().describe('Confidence score 0.0–1.0 for currency'),
    lineItems: zod_1.z.number().describe('Confidence score 0.0–1.0 for the line items array as a whole'),
});
