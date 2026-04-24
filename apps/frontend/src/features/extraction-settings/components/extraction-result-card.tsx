'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { Invoice } from '@opp/shared';

export interface ExtractionResultData {
  file?: File;
  result: {
    originalFileName: string;
    mimeType: string;
    maskedText: string;
    piiDetected: boolean;
    geminiResponse: Invoice;
    processedAt: string;
  };
}

/**
 * Stateless component to display extracted invoice data
 * Shows image on left, extracted details on right
 */
export function ExtractionResultCard({ data }: { data: ExtractionResultData }) {
  return (
    <Card className='overflow-hidden'>
      <CardContent className='p-0'>
        <div className='grid grid-cols-2 gap-0 min-h-screen'>
          {/* Left Column: Invoice Image */}
          {data.file && (
            <div className='flex items-center justify-center bg-muted p-4'>
              <div className='w-full h-full flex items-center justify-center rounded-lg border bg-white'>
                <img
                  src={URL.createObjectURL(data.file)}
                  alt='Uploaded invoice'
                  className='max-w-full max-h-full object-contain'
                />
              </div>
            </div>
          )}

          {/* Right Column: Extracted Data */}
          <div className='space-y-4 p-6 overflow-y-auto max-h-screen flex flex-col'>
            <div>
              <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                Invoice Details
              </p>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-xs font-medium text-muted-foreground'>Invoice Number</p>
                <p className='mt-2 text-lg font-semibold'>
                  {data.result.geminiResponse.invoiceNumber || '—'}
                </p>
              </div>
              <div>
                <p className='text-xs font-medium text-muted-foreground'>Currency</p>
                <p className='mt-2 text-lg font-semibold'>
                  {data.result.geminiResponse.currency || '—'}
                </p>
              </div>
              <div>
                <p className='text-xs font-medium text-muted-foreground'>Issue Date</p>
                <p className='mt-2 text-sm'>{data.result.geminiResponse.issueDate || '—'}</p>
              </div>
              <div>
                <p className='text-xs font-medium text-muted-foreground'>Due Date</p>
                <p className='mt-2 text-sm'>{data.result.geminiResponse.dueDate || '—'}</p>
              </div>
            </div>

            <div className='border-t pt-4'>
              <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3'>
                Vendor
              </p>
              <p className='font-semibold'>{data.result.geminiResponse.vendorName || '—'}</p>
              <p className='text-sm text-muted-foreground'>
                {data.result.geminiResponse.vendorAddress || '—'}
              </p>
            </div>

            <div className='border-t pt-4'>
              <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3'>
                Customer
              </p>
              <p className='font-semibold'>{data.result.geminiResponse.customerName || '—'}</p>
              <p className='text-sm text-muted-foreground'>
                {data.result.geminiResponse.customerAddress || '—'}
              </p>
            </div>

            <div className='border-t pt-4 space-y-3'>
              <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                Summary
              </p>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Subtotal:</span>
                <span className='font-semibold'>${data.result.geminiResponse.subtotal}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Tax:</span>
                <span className='font-semibold'>${data.result.geminiResponse.taxAmount}</span>
              </div>
              <div className='flex justify-between border-t pt-3 text-lg font-bold'>
                <span>Total:</span>
                <span>${data.result.geminiResponse.totalAmount}</span>
              </div>
            </div>

            {/* Line Items */}
            {data.result.geminiResponse.lineItems &&
              data.result.geminiResponse.lineItems.length > 0 && (
                <div className='border-t pt-4 space-y-3'>
                  <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                    Line Items
                  </p>
                  <div className='space-y-2'>
                    {data.result.geminiResponse.lineItems.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className='flex items-center justify-between rounded-lg border p-2 text-sm'
                      >
                        <div className='flex-1'>
                          <p className='font-medium text-xs'>{item.description}</p>
                          <p className='text-xs text-muted-foreground'>
                            {item.quantity} x ${item.unitPrice}
                          </p>
                        </div>
                        <p className='font-semibold text-xs'>${item.totalPrice}</p>
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
