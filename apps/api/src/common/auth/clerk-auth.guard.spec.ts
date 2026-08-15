import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { verifyToken } from '@clerk/backend';

// @clerk/backend ships a real CommonJS build (unlike the AI SDK packages),
// so a plain jest.mock() works here without the "fully manual mock, no
// requireActual" workaround diagnostics.service.spec.ts needed for 'ai'.
jest.mock('@clerk/backend', () => ({ verifyToken: jest.fn() }));

const mockVerifyToken = verifyToken as jest.Mock;

function makeContext(authorizationHeader: string | undefined): {
  context: ExecutionContext;
  request: Record<string, unknown>;
} {
  const request: Record<string, unknown> = {
    headers: { authorization: authorizationHeader },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('ClerkAuthGuard', () => {
  const originalSecretKey = process.env.CLERK_SECRET_KEY;

  beforeEach(() => {
    mockVerifyToken.mockReset();
    process.env.CLERK_SECRET_KEY = 'test-secret-key';
  });

  afterAll(() => {
    process.env.CLERK_SECRET_KEY = originalSecretKey;
  });

  it('throws if CLERK_SECRET_KEY is not configured, without attempting verification', async () => {
    delete process.env.CLERK_SECRET_KEY;
    const guard = new ClerkAuthGuard();
    const { context } = makeContext('Bearer some-token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      'CLERK_SECRET_KEY is not configured',
    );
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it('rejects a request with no Authorization header', async () => {
    const guard = new ClerkAuthGuard();
    const { context } = makeContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  it('rejects a non-Bearer Authorization header', async () => {
    const guard = new ClerkAuthGuard();
    const { context } = makeContext('Basic dXNlcjpwYXNz');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token that fails verification', async () => {
    mockVerifyToken.mockRejectedValue(new Error('expired'));
    const guard = new ClerkAuthGuard();
    const { context } = makeContext('Bearer bad-token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('attaches the verified Clerk userId to the request and allows the request through', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user_123' });
    const guard = new ClerkAuthGuard();
    const { context, request } = makeContext('Bearer good-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.clerkUserId).toBe('user_123');
    expect(mockVerifyToken).toHaveBeenCalledWith('good-token', {
      secretKey: 'test-secret-key',
    });
  });
});
