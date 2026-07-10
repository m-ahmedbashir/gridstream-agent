import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DEFAULT_MODEL_KEY, MODEL_REGISTRY, type ModelKey } from '../extraction/model-registry';

export interface SettingsUpdate {
  extractionMode?: string;
  modelKey?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId: userId },
      select: { extractionMode: true, modelKey: true },
    });

    // Return defaults if user doesn't exist yet
    return {
      extractionMode: user?.extractionMode || 'MANUAL_REVIEW',
      modelKey: user?.modelKey || DEFAULT_MODEL_KEY,
    };
  }

  async updateSettings(userId: string, updates: SettingsUpdate) {
    if (updates.modelKey && !(updates.modelKey in MODEL_REGISTRY)) {
      throw new BadRequestException(
        `Unknown modelKey "${updates.modelKey}". Valid keys: ${Object.keys(MODEL_REGISTRY).join(', ')}`,
      );
    }

    // Create user if doesn't exist, then update — only touching the fields actually
    // provided, so changing one setting never silently resets the other to a default.
    const user = await this.prisma.user.upsert({
      where: { clerkId: userId },
      create: {
        clerkId: userId,
        extractionMode: updates.extractionMode ?? 'MANUAL_REVIEW',
        modelKey: (updates.modelKey as ModelKey) ?? DEFAULT_MODEL_KEY,
      },
      update: {
        ...(updates.extractionMode !== undefined && { extractionMode: updates.extractionMode }),
        ...(updates.modelKey !== undefined && { modelKey: updates.modelKey }),
      },
      select: { extractionMode: true, modelKey: true, updatedAt: true },
    });

    return user;
  }
}
