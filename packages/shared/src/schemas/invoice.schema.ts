import { z } from 'zod';

export const InvoiceLineItemSchema = z.object({
    description: z.string().describe('Item description'),
    quantity: z.number().describe('Item quantity'),
    unitPrice: z.number().describe('Price per unit'),
    totalPrice: z.number().describe('Total price for this line item'),
});

export const InvoiceSchema = z.object({
    invoiceNumber: z.string().describe('Invoice number or ID'),
    issueDate: z.string().describe('Issue date of the invoice'),
    dueDate: z.string().describe('Payment due date'),
    vendorName: z.string().describe('Vendor/supplier name'),
    vendorAddress: z.string().describe('Vendor address'),
    customerName: z.string().describe('Customer/buyer name'),
    customerAddress: z.string().describe('Customer address'),
    lineItems: z.array(InvoiceLineItemSchema).describe('Array of line items'),
    subtotal: z.number().describe('Subtotal amount'),
    taxAmount: z.number().describe('Tax amount'),
    totalAmount: z.number().describe('Total invoice amount'),
    currency: z.string().describe('Currency code (e.g., USD)'),
}).strict();

export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;

export type InvoiceConfidence = {
    invoiceNumber: number;
    issueDate: number;
    dueDate: number;
    vendorName: number;
    vendorAddress: number;
    customerName: number;
    customerAddress: number;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    currency: number;
    lineItems: number;
};

