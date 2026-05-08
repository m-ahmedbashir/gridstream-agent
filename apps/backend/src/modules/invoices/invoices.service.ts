import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Invoice, InvoiceConfidence } from '@opp/shared';

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
        invoiceNumber: invoiceData.invoiceNumber,
        issueDate: invoiceData.issueDate,
        dueDate: invoiceData.dueDate,
        vendorName: invoiceData.vendorName,
        vendorAddress: invoiceData.vendorAddress,
        customerName: invoiceData.customerName,
        customerAddress: invoiceData.customerAddress,
        subtotal: invoiceData.subtotal,
        taxAmount: invoiceData.taxAmount,
        totalAmount: invoiceData.totalAmount,
        currency: invoiceData.currency,
        lineItems: invoiceData.lineItems as any,
        fieldConfidence: fieldConfidence ? (fieldConfidence as any) : undefined,
        avgConfidence: avgConfidence ?? undefined,
        status: 'APPROVED',
    };

    if (invoiceId) {
      return this.prisma.invoice.update({
        where: { id: invoiceId },
        data: dataPayload,
      });
    }

    return this.prisma.invoice.create({
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
  }

  async getInvoicesByUser(userId: string) {
    return this.prisma.invoice.findMany({
      where: {
        user: { clerkId: userId }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async deleteInvoiceById(invoiceId: string) {
    return this.prisma.invoice.delete({
      where: { id: invoiceId },
    });
  }

  async deleteInvoiceByNumber(invoiceNumber: string) {
    return this.prisma.invoice.deleteMany({
      where: { invoiceNumber },
    });
  }
}
