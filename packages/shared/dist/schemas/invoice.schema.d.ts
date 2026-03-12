import { z } from 'zod';
export declare const InvoiceLineItemSchema: z.ZodObject<{
    description: z.ZodNullable<z.ZodString>;
    quantity: z.ZodNullable<z.ZodNumber>;
    unitPrice: z.ZodNullable<z.ZodNumber>;
    totalPrice: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
export declare const InvoiceSchema: z.ZodObject<{
    invoiceNumber: z.ZodNullable<z.ZodString>;
    issueDate: z.ZodNullable<z.ZodString>;
    dueDate: z.ZodNullable<z.ZodString>;
    vendorName: z.ZodNullable<z.ZodString>;
    vendorAddress: z.ZodNullable<z.ZodString>;
    customerName: z.ZodNullable<z.ZodString>;
    customerAddress: z.ZodNullable<z.ZodString>;
    lineItems: z.ZodDefault<z.ZodNullable<z.ZodArray<z.ZodObject<{
        description: z.ZodNullable<z.ZodString>;
        quantity: z.ZodNullable<z.ZodNumber>;
        unitPrice: z.ZodNullable<z.ZodNumber>;
        totalPrice: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strip>>>>;
    subtotal: z.ZodNullable<z.ZodNumber>;
    taxAmount: z.ZodNullable<z.ZodNumber>;
    totalAmount: z.ZodNullable<z.ZodNumber>;
    currency: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;
