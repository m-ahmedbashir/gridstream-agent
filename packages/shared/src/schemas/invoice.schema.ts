import { z } from 'zod';

export const InvoiceLineItemSchema = z.object({
    description: z.string().nullable(),
    quantity: z.number().nullable(),
    unitPrice: z.number().nullable(),
    totalPrice: z.number().nullable(),
});

export const InvoiceSchema = z.object({
    invoiceNumber: z.string().nullable(),
    issueDate: z.string().nullable(),
    dueDate: z.string().nullable(),
    vendorName: z.string().nullable(),
    vendorAddress: z.string().nullable(),
    customerName: z.string().nullable(),
    customerAddress: z.string().nullable(),
    lineItems: z.array(InvoiceLineItemSchema).nullable().default([]),
    subtotal: z.number().nullable(),
    taxAmount: z.number().nullable(),
    totalAmount: z.number().nullable(),
    currency: z.string().nullable(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;
