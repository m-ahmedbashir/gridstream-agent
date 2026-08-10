'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@clerk/nextjs';
import { useSaveInvoice } from '@/features/invoice-upload/use-save-invoice';
import { IconDeviceFloppy, IconPencil, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import type { Invoice, InvoiceConfidence } from '@maintain/shared';
import type { DocumentType, ExtractedData, ExtractedConfidence } from '@/features/invoice-upload/use-extract-invoice';
import { DOCUMENT_UI_CONFIGS, type FieldConfig } from './document-field-configs';

export interface ExtractionResultData {
  file?: File;
  result: {
    originalFileName: string;
    mimeType: string;
    maskedText: string;
    piiDetected: boolean;
    imagePiiDetected?: boolean;
    documentType: DocumentType;
    extractedData: ExtractedData;
    confidence?: ExtractedConfidence;
    avgConfidence?: number;
    processedAt: string;
  };
}

// ── Generic helpers ─────────────────────────────────────────────────────────

type DataRecord = Record<string, unknown>;
type ConfidenceRecord = Record<string, number | undefined>;

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

function EditToggle({ editing, onToggle, disabled }: { editing: boolean; onToggle: () => void; disabled: boolean }) {
  return editing ? (
    <Button onClick={onToggle} disabled={disabled} size="sm" variant="outline" className="h-7 px-2 gap-1 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-400">
      <IconCheck className="w-3.5 h-3.5" />
      Save
    </Button>
  ) : (
    <Button onClick={onToggle} disabled={disabled} size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground">
      <IconPencil className="w-4 h-4" />
    </Button>
  );
}

export function ExtractionResultCard({ data }: { data: ExtractionResultData }) {
  const { userId } = useAuth();
  const { mutate: saveInvoice, isPending } = useSaveInvoice();

  const documentType = data.result.documentType;
  const config = DOCUMENT_UI_CONFIGS[documentType];
  const confidence = (data.result.confidence ?? {}) as ConfidenceRecord;

  const [fields, setFields] = useState<DataRecord>(data.result.extractedData as DataRecord);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [editingSections, setEditingSections] = useState<Record<string, boolean>>({});

  const toggleEdit = (key: string) => setEditingSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = () => {
    if (documentType !== 'invoice') return;
    const currentUserId = userId || (typeof window !== 'undefined' ? localStorage.getItem('userId') : null) || 'default-user';
    saveInvoice(
      {
        invoiceData: fields as unknown as Invoice,
        userId: currentUserId,
        invoiceId: savedId || undefined,
        fieldConfidence: confidence as unknown as InvoiceConfidence,
        avgConfidence: data.result.avgConfidence,
      },
      {
        onSuccess: (res) => {
          if (res && res.id) setSavedId(res.id);
        },
      },
    );
  };

  const handleSaveSection = (key: string) => {
    toggleEdit(key);
    handleSave();
  };

  const handleChange = (key: string, value: string | number) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleItemChange = (sectionKey: string, index: number, field: string, value: string | number) => {
    setFields((prev) => {
      const items = [...((prev[sectionKey] as DataRecord[] | undefined) ?? [])];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, [sectionKey]: items };
    });
  };

  const handleListItemChange = (sectionKey: string, index: number, value: string) => {
    setFields((prev) => {
      const items = [...((prev[sectionKey] as string[] | undefined) ?? [])];
      items[index] = value;
      return { ...prev, [sectionKey]: items };
    });
  };

  const renderInput = (fieldConfig: FieldConfig, value: unknown, onChange: (v: string | number) => void, className: string) => {
    if (fieldConfig.type === 'number') {
      return (
        <Input
          type="number"
          step="0.01"
          value={(value as number) ?? 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={className}
        />
      );
    }
    return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} className={className} />;
  };

  return (
    <Card className='overflow-hidden'>
      <CardContent className='p-0'>
        <div className='grid grid-cols-2 gap-0 min-h-screen'>
          {/* Left Column: Document Image */}
          {data.file ? (
            <div className='flex items-center justify-center bg-muted p-4'>
              <div className='w-full max-h-[90vh] flex items-center justify-center rounded-lg border bg-white overflow-hidden'>
                <img
                  src={URL.createObjectURL(data.file)}
                  alt='Uploaded document'
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
                 <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground capitalize">
                   {documentType}
                 </span>
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
               {documentType === 'invoice' ? (
                 <Button onClick={handleSave} disabled={isPending} className="gap-2 shrink-0">
                   <IconDeviceFloppy className="w-4 h-4" />
                   {isPending ? 'Saving...' : 'Save Invoice'}
                 </Button>
               ) : (
                 <span className="text-xs text-muted-foreground shrink-0">Review only — saving isn&apos;t wired up for this document type yet</span>
               )}
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

            {/* FIELD SECTIONS */}
            {config.sections.map((section) => {
              const editing = !!editingSections[section.key];
              return (
                <div key={section.key} className='border-t first:border-t-0 pt-4 first:pt-0 space-y-4'>
                  <div className='flex items-center justify-between'>
                    <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>{section.title}</p>
                    <EditToggle editing={editing} disabled={isPending} onToggle={() => handleSaveSection(section.key)} />
                  </div>
                  <div className='grid grid-cols-2 gap-4'>
                    {section.fields.map((fieldConfig) => (
                      <div key={fieldConfig.key} className={`space-y-1 ${fieldConfig.fullWidth ? 'col-span-2' : ''}`}>
                        <p className='text-xs font-medium text-muted-foreground'>
                          {fieldConfig.label}
                          <ConfidenceBadge score={confidence[fieldConfig.key]} />
                        </p>
                        {editing
                          ? renderInput(fieldConfig, fields[fieldConfig.key], (v) => handleChange(fieldConfig.key, v), 'h-8 text-sm')
                          : <p className='text-sm font-medium'>{(fields[fieldConfig.key] as string | number | null) ?? '—'}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* SUMMARY SECTION */}
            {config.summaryFields && (
              <div className='border-t pt-4 space-y-3'>
                <div className='flex items-center justify-between'>
                  <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>Summary</p>
                  <EditToggle editing={!!editingSections.summary} disabled={isPending} onToggle={() => handleSaveSection('summary')} />
                </div>
                {config.summaryFields.map((fieldConfig) => (
                  <div key={fieldConfig.key} className='flex items-center justify-between gap-4'>
                    <span className='text-muted-foreground text-sm w-28 flex items-center'>
                      {fieldConfig.label}:<ConfidenceBadge score={confidence[fieldConfig.key]} />
                    </span>
                    {editingSections.summary
                      ? renderInput(fieldConfig, fields[fieldConfig.key], (v) => handleChange(fieldConfig.key, v), 'h-8 text-right flex-1')
                      : <span className='text-sm font-semibold'>{(fields[fieldConfig.key] as number) ?? 0}</span>}
                  </div>
                ))}
                {config.totalField && (
                  <div className='flex items-center justify-between gap-4 border-t pt-3'>
                    <span className='font-bold w-28 flex items-center'>
                      {config.totalField.label}:<ConfidenceBadge score={confidence[config.totalField.key]} />
                    </span>
                    {editingSections.summary
                      ? renderInput(config.totalField, fields[config.totalField.key], (v) => handleChange(config.totalField!.key, v), 'h-8 text-right flex-1 font-bold')
                      : <span className='font-bold'>{(fields[config.totalField.key] as number) ?? 0}</span>}
                  </div>
                )}
              </div>
            )}

            {/* LIST SECTIONS (e.g. skills) */}
            {config.listSections?.map((section) => {
              const items = (fields[section.key] as string[] | undefined) ?? [];
              if (items.length === 0) return null;
              const editing = !!editingSections[section.key];
              return (
                <div key={section.key} className='border-t pt-4 space-y-3'>
                  <div className='flex items-center justify-between'>
                    <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center'>
                      {section.title}<ConfidenceBadge score={confidence[section.key]} />
                    </p>
                    <EditToggle editing={editing} disabled={isPending} onToggle={() => handleSaveSection(section.key)} />
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    {items.map((item, idx) =>
                      editing ? (
                        <Input key={idx} value={item} onChange={(e) => handleListItemChange(section.key, idx, e.target.value)} className="h-7 text-xs w-32" />
                      ) : (
                        <span key={idx} className='text-xs rounded-full bg-secondary px-2.5 py-1'>{item}</span>
                      ),
                    )}
                  </div>
                </div>
              );
            })}

            {/* ITEM SECTIONS (e.g. line items, receipt items, experience, education) */}
            {config.itemSections?.map((section) => {
              const items = (fields[section.key] as DataRecord[] | undefined) ?? [];
              if (items.length === 0) return null;
              const editing = !!editingSections[section.key];
              return (
                <div key={section.key} className='border-t pt-4 space-y-3 pb-8'>
                  <div className='flex items-center justify-between'>
                    <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center'>
                      {section.title}<ConfidenceBadge score={confidence[section.key]} />
                    </p>
                    <EditToggle editing={editing} disabled={isPending} onToggle={() => handleSaveSection(section.key)} />
                  </div>
                  <div className='space-y-3'>
                    {items.map((item, itemIdx) => (
                      <div key={itemIdx} className='flex flex-col gap-2 rounded-lg border p-3 text-sm'>
                        {section.itemFields.map((fieldConfig) => (
                          <div key={fieldConfig.key} className='flex items-center justify-between gap-2'>
                            <span className='text-xs text-muted-foreground w-16 shrink-0'>{fieldConfig.label}:</span>
                            {editing
                              ? renderInput(fieldConfig, item[fieldConfig.key], (v) => handleItemChange(section.key, itemIdx, fieldConfig.key, v), 'h-8 text-xs flex-1')
                              : (
                                <span className={`text-xs flex-1 ${fieldConfig.key === section.totalField ? 'font-semibold text-right' : ''}`}>
                                  {(item[fieldConfig.key] as string | number | null) ?? '—'}
                                </span>
                              )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
