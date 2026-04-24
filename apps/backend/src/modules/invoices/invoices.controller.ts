import { Controller, Post, Body } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { Invoice } from '@opp/shared';

@Controller('invoices')
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Post('save')
  async save(@Body() body: { invoiceData: Invoice; userId: string; invoiceId?: string }) {
    return this.invoicesService.saveInvoice(body.invoiceData, body.userId, body.invoiceId);
  }
}
