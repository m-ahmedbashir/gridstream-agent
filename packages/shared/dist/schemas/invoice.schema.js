"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceSchema = exports.InvoiceLineItemSchema = void 0;
const zod_1 = require("zod");
exports.InvoiceLineItemSchema = zod_1.z.object({
    description: zod_1.z.string().nullable(),
    quantity: zod_1.z.number().nullable(),
    unitPrice: zod_1.z.number().nullable(),
    totalPrice: zod_1.z.number().nullable(),
});
exports.InvoiceSchema = zod_1.z.object({
    invoiceNumber: zod_1.z.string().nullable(),
    issueDate: zod_1.z.string().nullable(),
    dueDate: zod_1.z.string().nullable(),
    vendorName: zod_1.z.string().nullable(),
    vendorAddress: zod_1.z.string().nullable(),
    customerName: zod_1.z.string().nullable(),
    customerAddress: zod_1.z.string().nullable(),
    lineItems: zod_1.z.array(exports.InvoiceLineItemSchema).nullable().default([]),
    subtotal: zod_1.z.number().nullable(),
    taxAmount: zod_1.z.number().nullable(),
    totalAmount: zod_1.z.number().nullable(),
    currency: zod_1.z.string().nullable(),
});
