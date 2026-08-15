import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ClerkAuthGuard } from '../../common/auth/clerk-auth.guard';
import { ClerkUserId } from '../../common/auth/clerk-user-id.decorator';
import { DiagnosticsService } from './diagnostics.service';

/**
 * Query params for GET /diagnostics — a DTO used only by this one
 * endpoint, so it stays inline per AGENTS.md's minimal-footprint rule
 * rather than living in packages/shared.
 */
const listQuerySchema = z.object({
  status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

@Controller('diagnostics')
@UseGuards(ClerkAuthGuard)
export class DiagnosticsController {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  @Get()
  async list(@Query() query: unknown) {
    const parsed = listQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return this.diagnosticsService.listDiagnostics(parsed.data);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.diagnosticsService.getDiagnosticById(id);
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string, @ClerkUserId() clerkUserId: string) {
    return this.diagnosticsService.approve(id, clerkUserId);
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string, @ClerkUserId() clerkUserId: string) {
    return this.diagnosticsService.reject(id, clerkUserId);
  }
}
