import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * The Clerk userId `ClerkAuthGuard` verified for this request. Only usable
 * on a route guarded by `ClerkAuthGuard` — elsewhere `request.clerkUserId`
 * was never set.
 */
export const ClerkUserId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request & { clerkUserId?: string }>();
  return request.clerkUserId as string;
});
