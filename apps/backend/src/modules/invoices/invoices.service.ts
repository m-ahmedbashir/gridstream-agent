import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Invoice, InvoiceConfidence } from '@opp/shared';

/**
 * Backs the `/invoices` API (still invoice-specific — the chat assistant's
 * getInvoices/deleteInvoice HITL tools and the review card's save flow all
 * depend on this flat shape). Underneath, storage is the generic `Document`
 * table (documentType + a JSON `data` column, shared with receipts/resumes
 * extracted via the document-type registry) — `flatten()` spreads `data`
 * back onto the row so existing consumers see the same shape as before.
 */
@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async saveInvoice(
    invoiceData: Invoice,
    userId: string,
    invoiceId?: string,
    fieldConfidence?: InvoiceConfidence,
    avgConfidence?: number,
  ) {
    const dataPayload = {
        documentType: 'invoice',
        data: invoiceData as any,
        fieldConfidence: fieldConfidence ? (fieldConfidence as any) : undefined,
        avgConfidence: avgConfidence ?? undefined,
        status: 'APPROVED',
    };

    if (invoiceId) {
      const updated = await this.prisma.document.update({
        where: { id: invoiceId },
        data: dataPayload,
      });
      return this.flatten(updated);
    }

    const created = await this.prisma.document.create({
      data: {
        user: {
          connectOrCreate: {
            where: { clerkId: userId },
            create: { clerkId: userId }
          }
        },
        ...dataPayload
      },
    });
    return this.flatten(created);
  }

  async getInvoicesByUser(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        user: { clerkId: userId },
        documentType: 'invoice',
      },
      orderBy: { createdAt: 'desc' }
    });
    return documents.map((document) => this.flatten(document));
  }

  async deleteInvoiceById(invoiceId: string) {
    return this.prisma.document.delete({
      where: { id: invoiceId },
    });
  }

  async deleteInvoiceByNumber(invoiceNumber: string) {
    return this.prisma.document.deleteMany({
      where: {
        documentType: 'invoice',
        data: { path: ['invoiceNumber'], equals: invoiceNumber },
      },
    });
  }

  /** Spreads the generic `data` JSON column back onto the row so callers see the pre-migration flat Invoice shape. */
  private flatten(document: { data: unknown } & Record<string, unknown>) {
    const { data, ...rest } = document;
    return { ...rest, ...(data as Record<string, unknown>) };
  }
}
