import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Invoice } from '@opp/shared';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async saveInvoice(invoiceData: Invoice, userId: string) {
    return this.prisma.invoice.create({
      data: {
        user: {
          connectOrCreate: {
            where: { clerkId: userId },
            create: { clerkId: userId }
          }
        },
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
        status: 'APPROVED',
      },
    });
  }
}
