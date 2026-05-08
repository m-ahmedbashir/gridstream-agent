"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceSchema = exports.InvoiceLineItemSchema = void 0;
const zod_1 = require("zod");
exports.InvoiceLineItemSchema = zod_1.z.object({
    description: zod_1.z.string().describe('Item description'),
    quantity: zod_1.z.number().describe('Item quantity'),
    unitPrice: zod_1.z.number().describe('Price per unit'),
    totalPrice: zod_1.z.number().describe('Total price for this line item'),
});
exports.InvoiceSchema = zod_1.z.object({
    invoiceNumber: zod_1.z.string().describe('Invoice number or ID'),
    issueDate: zod_1.z.string().describe('Issue date of the invoice'),
    dueDate: zod_1.z.string().describe('Payment due date'),
    vendorName: zod_1.z.string().describe('Vendor/supplier name'),
    vendorAddress: zod_1.z.string().describe('Vendor address'),
    customerName: zod_1.z.string().describe('Customer/buyer name'),
    customerAddress: zod_1.z.string().describe('Customer address'),
    lineItems: zod_1.z.array(exports.InvoiceLineItemSchema).describe('Array of line items'),
    subtotal: zod_1.z.number().describe('Subtotal amount'),
    taxAmount: zod_1.z.number().describe('Tax amount'),
    totalAmount: zod_1.z.number().describe('Total invoice amount'),
    currency: zod_1.z.string().describe('Currency code (e.g., USD)'),
}).strict();
