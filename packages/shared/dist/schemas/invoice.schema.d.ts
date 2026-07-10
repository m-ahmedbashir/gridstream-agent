import { z } from 'zod';
export declare const InvoiceLineItemSchema: z.ZodObject<{
    description: z.ZodString;
    quantity: z.ZodNumber;
    unitPrice: z.ZodNumber;
    totalPrice: z.ZodNumber;
}, z.core.$strip>;
export declare const InvoiceSchema: z.ZodObject<{
    invoiceNumber: z.ZodString;
    issueDate: z.ZodString;
    dueDate: z.ZodString;
    vendorName: z.ZodString;
    vendorAddress: z.ZodString;
    customerName: z.ZodString;
    customerAddress: z.ZodString;
    lineItems: z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        totalPrice: z.ZodNumber;
    }, z.core.$strip>>;
    subtotal: z.ZodNumber;
    taxAmount: z.ZodNumber;
    totalAmount: z.ZodNumber;
    currency: z.ZodString;
}, z.core.$strict>;
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
