import { Controller, Post, Body, Get, Param, Delete } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { Invoice, InvoiceConfidence } from '@maintain/shared';

@Controller('invoices')
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get('user/:userId')
  async getInvoicesByUser(@Param('userId') userId: string) {
    return this.invoicesService.getInvoicesByUser(userId);
  }

  @Post('save')
  async save(@Body() body: {
    invoiceData: Invoice;
    userId: string;
    invoiceId?: string;
    fieldConfidence?: InvoiceConfidence;
    avgConfidence?: number;
  }) {
    return this.invoicesService.saveInvoice(
      body.invoiceData,
      body.userId,
      body.invoiceId,
      body.fieldConfidence,
      body.avgConfidence,
    );
  }

  @Delete(':invoiceId')
  async deleteInvoice(@Param('invoiceId') invoiceId: string) {
    return this.invoicesService.deleteInvoiceById(invoiceId);
  }

  @Post('delete-by-number')
  async deleteByNumber(@Body() body: { invoiceNumber: string }) {
    return this.invoicesService.deleteInvoiceByNumber(body.invoiceNumber);
  }
}
