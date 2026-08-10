import type { DocumentType } from '@/features/invoice-upload/use-extract-invoice';

export type FieldType = 'text' | 'number';

export interface FieldConfig {
    key: string;
    label: string;
    type: FieldType;
    fullWidth?: boolean;
}

export interface ItemSectionConfig {
    /** Array field key on the extracted data, e.g. 'lineItems'. */
    key: string;
    title: string;
    itemFields: FieldConfig[];
    /** Field key within each item to render bold as that row's total, e.g. 'totalPrice'. */
    totalField?: string;
}

export interface ListSectionConfig {
    /** string[] field key on the extracted data, e.g. 'skills'. */
    key: string;
    title: string;
}

export interface DocumentUIConfig {
    sections: { key: string; title: string; fields: FieldConfig[] }[];
    /** Money-style rows rendered with a currency prefix, e.g. subtotal/tax. */
    summaryFields?: FieldConfig[];
    /** Bold final total row rendered under summaryFields. */
    totalField?: FieldConfig;
    itemSections?: ItemSectionConfig[];
    listSections?: ListSectionConfig[];
}

const INVOICE_CONFIG: DocumentUIConfig = {
    sections: [
        {
            key: 'details',
            title: 'Invoice Details',
            fields: [
                { key: 'invoiceNumber', label: 'Invoice Number', type: 'text' },
                { key: 'currency', label: 'Currency', type: 'text' },
                { key: 'issueDate', label: 'Issue Date', type: 'text' },
                { key: 'dueDate', label: 'Due Date', type: 'text' },
            ],
        },
        {
            key: 'vendor',
            title: 'Vendor',
            fields: [
                { key: 'vendorName', label: 'Name', type: 'text' },
                { key: 'vendorAddress', label: 'Address', type: 'text' },
            ],
        },
        {
            key: 'customer',
            title: 'Customer',
            fields: [
                { key: 'customerName', label: 'Name', type: 'text' },
                { key: 'customerAddress', label: 'Address', type: 'text' },
            ],
        },
    ],
    summaryFields: [
        { key: 'subtotal', label: 'Subtotal', type: 'number' },
        { key: 'taxAmount', label: 'Tax', type: 'number' },
    ],
    totalField: { key: 'totalAmount', label: 'Total', type: 'number' },
    itemSections: [
        {
            key: 'lineItems',
            title: 'Line Items',
            itemFields: [
                { key: 'description', label: 'Desc', type: 'text' },
                { key: 'quantity', label: 'Qty', type: 'number' },
                { key: 'unitPrice', label: 'Price', type: 'number' },
            ],
            totalField: 'totalPrice',
        },
    ],
};

const RECEIPT_CONFIG: DocumentUIConfig = {
    sections: [
        {
            key: 'details',
            title: 'Transaction Details',
            fields: [
                { key: 'currency', label: 'Currency', type: 'text' },
                { key: 'paymentMethod', label: 'Payment Method', type: 'text' },
                { key: 'transactionDate', label: 'Date', type: 'text' },
                { key: 'transactionTime', label: 'Time', type: 'text' },
            ],
        },
        {
            key: 'merchant',
            title: 'Merchant',
            fields: [
                { key: 'merchantName', label: 'Name', type: 'text' },
                { key: 'merchantAddress', label: 'Address', type: 'text' },
            ],
        },
    ],
    summaryFields: [
        { key: 'subtotal', label: 'Subtotal', type: 'number' },
        { key: 'taxAmount', label: 'Tax', type: 'number' },
        { key: 'tipAmount', label: 'Tip', type: 'number' },
    ],
    totalField: { key: 'totalAmount', label: 'Total', type: 'number' },
    itemSections: [
        {
            key: 'items',
            title: 'Items',
            itemFields: [
                { key: 'description', label: 'Desc', type: 'text' },
                { key: 'quantity', label: 'Qty', type: 'number' },
                { key: 'unitPrice', label: 'Price', type: 'number' },
            ],
            totalField: 'totalPrice',
        },
    ],
};

const RESUME_CONFIG: DocumentUIConfig = {
    sections: [
        {
            key: 'candidate',
            title: 'Candidate',
            fields: [
                { key: 'fullName', label: 'Full Name', type: 'text' },
                { key: 'email', label: 'Email', type: 'text' },
                { key: 'phone', label: 'Phone', type: 'text' },
                { key: 'summary', label: 'Summary', type: 'text', fullWidth: true },
            ],
        },
    ],
    listSections: [{ key: 'skills', title: 'Skills' }],
    itemSections: [
        {
            key: 'experience',
            title: 'Experience',
            itemFields: [
                { key: 'company', label: 'Company', type: 'text' },
                { key: 'title', label: 'Title', type: 'text' },
                { key: 'startDate', label: 'Start', type: 'text' },
                { key: 'endDate', label: 'End', type: 'text' },
                { key: 'description', label: 'Description', type: 'text' },
            ],
        },
        {
            key: 'education',
            title: 'Education',
            itemFields: [
                { key: 'institution', label: 'Institution', type: 'text' },
                { key: 'degree', label: 'Degree', type: 'text' },
                { key: 'startDate', label: 'Start', type: 'text' },
                { key: 'endDate', label: 'End', type: 'text' },
            ],
        },
    ],
};

export const DOCUMENT_UI_CONFIGS: Record<DocumentType, DocumentUIConfig> = {
    invoice: INVOICE_CONFIG,
    receipt: RECEIPT_CONFIG,
    resume: RESUME_CONFIG,
};
