import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { clerkId: userId },
      select: { extractionMode: true },
    });

    // Return default if user doesn't exist yet
    return {
      extractionMode: user?.extractionMode || 'MANUAL_REVIEW',
    };
  }

  async updateSettings(userId: string, extractionMode: string) {
    // Create user if doesn't exist, then update
    const user = await this.prisma.user.upsert({
      where: { clerkId: userId },
      create: { clerkId: userId, extractionMode },
      update: { extractionMode },
      select: { extractionMode: true, updatedAt: true },
    });

    return user;
  }
}
