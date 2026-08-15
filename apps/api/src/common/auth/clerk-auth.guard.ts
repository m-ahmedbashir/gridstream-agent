import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';

/**
 * Verifies a Clerk session token sent as `Authorization: Bearer <token>`.
 * The only place a request's identity gets established for the endpoints
 * that use it — controllers read the result via `@ClerkUserId()`, never the
 * raw request.
 *
 * Fails closed, deliberately: a missing `CLERK_SECRET_KEY` throws
 * immediately rather than silently letting every request through. This is
 * a required security control, not a decorative call — no fallback makes
 * sense for "the guard can't verify anything."
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      throw new Error(
        'CLERK_SECRET_KEY is not configured — cannot verify any request.',
      );
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { clerkUserId?: string }>();
    const authHeader = request.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await verifyToken(token, { secretKey });
      request.clerkUserId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session token');
    }
  }
}
