'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@clerk/nextjs';
import { useSaveInvoice } from '@/features/invoice-upload/use-save-invoice';
import { IconDeviceFloppy, IconPencil, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import type { Invoice, InvoiceConfidence } from '@opp/shared';

export interface ExtractionResultData {
  file?: File;
  result: {
    originalFileName: string;
    mimeType: string;
    maskedText: string;
    piiDetected: boolean;
    imagePiiDetected?: boolean;
    extractedInvoice: Invoice;
    confidence?: InvoiceConfidence;
    avgConfidence?: number;
    processedAt: string;
  };
}

function ConfidenceBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return null;
  const pct = Math.round(score * 100);
  // Thresholds match the 6 discrete anchor values: 1.0 / 0.8 / 0.6 / 0.4 / 0.2 / 0.0
  const style =
    score >= 0.8
      ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
      : score >= 0.6
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'
      : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
  return (
    <span className={`ml-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${style}`}>
      {pct}%
    </span>
  );
}

export function ExtractionResultCard({ data }: { data: ExtractionResultData }) {
  const { userId } = useAuth();
  const { mutate: saveInvoice, isPending } = useSaveInvoice();

  const initialInvoiceData = data.result.extractedInvoice;
  const confidence = data.result.confidence;
  const [invoice, setInvoice] = useState<Invoice>(initialInvoiceData);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);

  const [editingSections, setEditingSections] = useState({
    details: false,
    vendor: false,
    customer: false,
    summary: false,
    lineItems: false
  });

  const toggleEdit = (section: keyof typeof editingSections) => {
    setEditingSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSave = () => {
    const currentUserId = userId || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null) || 'default-user';
    saveInvoice(
        {
            invoiceData: invoice,
            userId: currentUserId,
            invoiceId: savedInvoiceId || undefined,
            fieldConfidence: confidence,
            avgConfidence: data.result.avgConfidence,
        },
        {
            onSuccess: (data) => {
                if (data && data.id) {
                    setSavedInvoiceId(data.id);
                }
            }
        }
    );
  };

  const handleSaveSection = (section: keyof typeof editingSections) => {
    toggleEdit(section);
    handleSave();
  };

  const handleChange = (field: keyof Invoice, value: string | number) => {
    setInvoice(prev => ({ ...prev, [field]: value }));
  };

  const handleLineItemChange = (index: number, field: string, value: string | number) => {
    setInvoice(prev => {
        const newLineItems = [...(prev.lineItems || [])];
        newLineItems[index] = { ...newLineItems[index], [field]: value };
        return { ...prev, lineItems: newLineItems };
    });
  };

  return (
    <Card className='overflow-hidden'>
      <CardContent className='p-0'>
        <div className='grid grid-cols-2 gap-0 min-h-screen'>
          {/* Left Column: Invoice Image */}
          {data.file ? (
            <div className='flex items-center justify-center bg-muted p-4'>
              <div className='w-full max-h-[90vh] flex items-center justify-center rounded-lg border bg-white overflow-hidden'>
                <img
                  src={URL.createObjectURL(data.file)}
                  alt='Uploaded invoice'
                  className='max-w-full max-h-full object-contain'
                />
              </div>
            </div>
          ) : (
             <div className='flex items-center justify-center bg-muted p-4'>
                <p className="text-muted-foreground text-sm">No preview available</p>
             </div>
          )}

          {/* Right Column: Extracted Data */}
          <div className='space-y-6 p-6 overflow-y-auto max-h-[90vh] flex flex-col'>
            
            {/* GLOBAL ACTIONS */}
            <div className="flex items-center justify-between pb-2 border-b">
               <div className="flex items-center gap-2">
                 <h3 className="text-lg font-semibold">Extracted Data</h3>
                 {data.result.avgConfidence !== undefined && (
                   <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                     data.result.avgConfidence >= 0.8
                       ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                       : data.result.avgConfidence >= 0.6
                       ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'
                       : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                   }`}>
                     Avg. confidence {Math.round(data.result.avgConfidence * 100)}%
                   </span>
                 )}
               </div>
               <Button onClick={handleSave} disabled={isPending} className="gap-2 shrink-0">
                 <IconDeviceFloppy className="w-4 h-4" />
                 {isPending ? 'Saving...' : 'Save Invoice'}
               </Button>
            </div>

            {data.result.imagePiiDetected && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                <IconAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  This document appears to show personal or financial details (email, phone, IBAN, or card number)
                  directly in the image. Text-based PII masking can&apos;t redact pixels — review the fields below
                  carefully before saving.
                </span>
              </div>
            )}

            {/* DETAILS SECTION */}
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                  Invoice Details
                </p>
                {editingSections.details ? (
                  <Button onClick={() => handleSaveSection('details')} disabled={isPending} size="sm" variant="outline" className="h-7 px-2 gap-1 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
                    <IconCheck className="w-3.5 h-3.5" />
                    Save
                  </Button>
                ) : (
                  <Button onClick={() => toggleEdit('details')} disabled={isPending} size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground">
                    <IconPencil className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-1'>
                  <p className='text-xs font-medium text-muted-foreground'>
                    Invoice Number<ConfidenceBadge score={confidence?.invoiceNumber} />
                  </p>
                  {editingSections.details ? (
                     <Input value={invoice.invoiceNumber || ''} onChange={(e) => handleChange('invoiceNumber', e.target.value)} className="h-8 text-sm" />
                  ) : (
                     <p className='text-sm font-semibold'>{invoice.invoiceNumber || '—'}</p>
                  )}
                </div>
                <div className='space-y-1'>
                  <p className='text-xs font-medium text-muted-foreground'>
                    Currency<ConfidenceBadge score={confidence?.currency} />
                  </p>
                  {editingSections.details ? (
                     <Input value={invoice.currency || ''} onChange={(e) => handleChange('currency', e.target.value)} className="h-8 text-sm" />
                  ) : (
                     <p className='text-sm font-semibold'>{invoice.currency || '—'}</p>
                  )}
                </div>
                <div className='space-y-1'>
                  <p className='text-xs font-medium text-muted-foreground'>
                    Issue Date<ConfidenceBadge score={confidence?.issueDate} />
                  </p>
                  {editingSections.details ? (
                     <Input value={invoice.issueDate || ''} onChange={(e) => handleChange('issueDate', e.target.value)} className="h-8 text-sm" />
                  ) : (
                     <p className='text-sm'>{invoice.issueDate || '—'}</p>
                  )}
                </div>
                <div className='space-y-1'>
                  <p className='text-xs font-medium text-muted-foreground'>
                    Due Date<ConfidenceBadge score={confidence?.dueDate} />
                  </p>
                  {editingSections.details ? (
                     <Input value={invoice.dueDate || ''} onChange={(e) => handleChange('dueDate', e.target.value)} className="h-8 text-sm" />
                  ) : (
                     <p className='text-sm'>{invoice.dueDate || '—'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* VENDOR SECTION */}
            <div className='border-t pt-4 space-y-4'>
              <div className='flex items-center justify-between'>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                  Vendor
                </p>
                {editingSections.vendor ? (
                  <Button onClick={() => handleSaveSection('vendor')} disabled={isPending} size="sm" variant="outline" className="h-7 px-2 gap-1 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
                    <IconCheck className="w-3.5 h-3.5" />
                    Save
                  </Button>
                ) : (
                  <Button onClick={() => toggleEdit('vendor')} disabled={isPending} size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground">
                    <IconPencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className='space-y-1'>
                <p className='text-xs font-medium text-muted-foreground'>
                  Name<ConfidenceBadge score={confidence?.vendorName} />
                </p>
                {editingSections.vendor ? (
                   <Input value={invoice.vendorName || ''} onChange={(e) => handleChange('vendorName', e.target.value)} className="h-8 text-sm" />
                ) : (
                   <p className="text-sm font-semibold">{invoice.vendorName || '—'}</p>
                )}
              </div>
              <div className='space-y-1'>
                <p className='text-xs font-medium text-muted-foreground'>
                  Address<ConfidenceBadge score={confidence?.vendorAddress} />
                </p>
                {editingSections.vendor ? (
                   <Input value={invoice.vendorAddress || ''} onChange={(e) => handleChange('vendorAddress', e.target.value)} className="h-8 text-sm" />
                ) : (
                   <p className="text-sm text-muted-foreground">{invoice.vendorAddress || '—'}</p>
                )}
              </div>
            </div>

            {/* CUSTOMER SECTION */}
            <div className='border-t pt-4 space-y-4'>
              <div className='flex items-center justify-between'>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                  Customer
                </p>
                {editingSections.customer ? (
                  <Button onClick={() => handleSaveSection('customer')} disabled={isPending} size="sm" variant="outline" className="h-7 px-2 gap-1 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
                    <IconCheck className="w-3.5 h-3.5" />
                    Save
                  </Button>
                ) : (
                  <Button onClick={() => toggleEdit('customer')} disabled={isPending} size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground">
                    <IconPencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className='space-y-1'>
                <p className='text-xs font-medium text-muted-foreground'>
                  Name<ConfidenceBadge score={confidence?.customerName} />
                </p>
                {editingSections.customer ? (
                   <Input value={invoice.customerName || ''} onChange={(e) => handleChange('customerName', e.target.value)} className="h-8 text-sm" />
                ) : (
                   <p className="text-sm font-semibold">{invoice.customerName || '—'}</p>
                )}
              </div>
              <div className='space-y-1'>
                <p className='text-xs font-medium text-muted-foreground'>
                  Address<ConfidenceBadge score={confidence?.customerAddress} />
                </p>
                {editingSections.customer ? (
                   <Input value={invoice.customerAddress || ''} onChange={(e) => handleChange('customerAddress', e.target.value)} className="h-8 text-sm" />
                ) : (
                   <p className="text-sm text-muted-foreground">{invoice.customerAddress || '—'}</p>
                )}
              </div>
            </div>

            {/* SUMMARY SECTION */}
            <div className='border-t pt-4 space-y-3'>
              <div className='flex items-center justify-between'>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                  Summary
                </p>
                {editingSections.summary ? (
                  <Button onClick={() => handleSaveSection('summary')} disabled={isPending} size="sm" variant="outline" className="h-7 px-2 gap-1 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
                    <IconCheck className="w-3.5 h-3.5" />
                    Save
                  </Button>
                ) : (
                  <Button onClick={() => toggleEdit('summary')} disabled={isPending} size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground">
                    <IconPencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <div className='flex items-center justify-between gap-4'>
                <span className='text-muted-foreground text-sm w-28 flex items-center'>
                  Subtotal ($):<ConfidenceBadge score={confidence?.subtotal} />
                </span>
                {editingSections.summary ? (
                    <Input type="number" step="0.01" value={invoice.subtotal || 0} onChange={(e) => handleChange('subtotal', parseFloat(e.target.value) || 0)} className="h-8 text-right flex-1" />
                ) : (
                    <span className='text-sm font-semibold'>${invoice.subtotal}</span>
                )}
              </div>
              <div className='flex items-center justify-between gap-4'>
                <span className='text-muted-foreground text-sm w-28 flex items-center'>
                  Tax ($):<ConfidenceBadge score={confidence?.taxAmount} />
                </span>
                {editingSections.summary ? (
                    <Input type="number" step="0.01" value={invoice.taxAmount || 0} onChange={(e) => handleChange('taxAmount', parseFloat(e.target.value) || 0)} className="h-8 text-right flex-1" />
                ) : (
                    <span className='text-sm font-semibold'>${invoice.taxAmount}</span>
                )}
              </div>
              <div className='flex items-center justify-between gap-4 border-t pt-3'>
                <span className='font-bold w-28 flex items-center'>
                  Total ($):<ConfidenceBadge score={confidence?.totalAmount} />
                </span>
                {editingSections.summary ? (
                    <Input type="number" step="0.01" value={invoice.totalAmount || 0} onChange={(e) => handleChange('totalAmount', parseFloat(e.target.value) || 0)} className="h-8 text-right flex-1 font-bold" />
                ) : (
                    <span className='font-bold'>${invoice.totalAmount}</span>
                )}
              </div>
            </div>

            {/* LINE ITEMS SECTION */}
            {invoice.lineItems && invoice.lineItems.length > 0 && (
                <div className='border-t pt-4 space-y-3 pb-8'>
                  <div className='flex items-center justify-between'>
                    <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center'>
                      Line Items<ConfidenceBadge score={confidence?.lineItems} />
                    </p>
                    {editingSections.lineItems ? (
                      <Button onClick={() => handleSaveSection('lineItems')} disabled={isPending} size="sm" variant="outline" className="h-7 px-2 gap-1 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
                        <IconCheck className="w-3.5 h-3.5" />
                        Save
                      </Button>
                    ) : (
                      <Button onClick={() => toggleEdit('lineItems')} disabled={isPending} size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground">
                        <IconPencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className='space-y-3'>
                    {invoice.lineItems.map((item, itemIdx) => (
                      <div key={itemIdx} className='flex flex-col gap-2 rounded-lg border p-3 text-sm'>
                        <div className='flex items-center justify-between gap-2'>
                          <span className='text-xs text-muted-foreground w-12'>Desc:</span>
                          {editingSections.lineItems ? (
                              <Input value={item.description || ''} onChange={(e) => handleLineItemChange(itemIdx, 'description', e.target.value)} className="h-8 text-xs flex-1" />
                          ) : (
                              <span className='text-xs font-medium flex-1'>{item.description}</span>
                          )}
                        </div>
                        <div className='flex items-center justify-between gap-2'>
                          <span className='text-xs text-muted-foreground w-12'>Qty:</span>
                          {editingSections.lineItems ? (
                              <Input type="number" value={item.quantity || 0} onChange={(e) => handleLineItemChange(itemIdx, 'quantity', parseFloat(e.target.value) || 0)} className="h-8 text-xs w-20" />
                          ) : (
                              <span className='text-xs w-20'>{item.quantity}</span>
                          )}
                          <span className='text-xs text-muted-foreground ml-2 w-12'>Price:</span>
                          {editingSections.lineItems ? (
                              <Input type="number" step="0.01" value={item.unitPrice || 0} onChange={(e) => handleLineItemChange(itemIdx, 'unitPrice', parseFloat(e.target.value) || 0)} className="h-8 text-xs w-20" />
                          ) : (
                              <span className='text-xs w-20'>${item.unitPrice}</span>
                          )}
                        </div>
                        <div className='flex items-center justify-end gap-2 border-t pt-2 mt-1'>
                           <span className='text-xs font-semibold'>Total:</span>
                           {editingSections.lineItems ? (
                               <Input type="number" step="0.01" value={item.totalPrice || 0} onChange={(e) => handleLineItemChange(itemIdx, 'totalPrice', parseFloat(e.target.value) || 0)} className="h-8 w-24 text-xs font-semibold text-right" />
                           ) : (
                               <span className='text-xs font-semibold'>${item.totalPrice}</span>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
